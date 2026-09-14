/**
 * Screen payload for Cartões: same bill engine as the web app.
 * Never uses account.balance as open-bill total (that is total outstanding).
 */
import { jsonResponse } from "../middleware/http.ts";
import {
  buildCreditCardBills,
  formatDueMonthShort,
  formatDueMonthTitle,
  installmentNumberOf,
  installmentTotalOf,
  isBillPayment,
  resolvePurchaseDate,
  signedTxAmount,
  summarizeCardOpenBill,
  txBillingAmount,
} from "../creditBillPeriod.ts";
import {
  getPluggyApiKey,
  PLUGGY_API,
  pluggyJson,
  type PluggyClient,
} from "./pluggy.ts";

function money(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

function lastFour(account: Record<string, unknown>): string {
  const raw = String(account.number ?? (account.creditData as { number?: string } | undefined)?.number ?? "");
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(-4);
  return "****";
}

type FaceOverlay = {
  key?: string;
  facePath?: string;
  face_path?: string;
  faceUrl?: string;
  face_url?: string;
};

async function loadCardFaceOverlays(client: PluggyClient): Promise<{
  icons: Record<string, FaceOverlay>;
  names: Record<string, string>;
  signed: Record<string, string>;
}> {
  try {
    const { data } = await client.supabase
      .from("profiles")
      .select("custom_account_icons, custom_account_names")
      .eq("id", client.userId)
      .maybeSingle();
    const icons = (data?.custom_account_icons && typeof data.custom_account_icons === "object")
      ? data.custom_account_icons as Record<string, FaceOverlay>
      : {};
    const names = (data?.custom_account_names && typeof data.custom_account_names === "object")
      ? Object.fromEntries(
        Object.entries(data.custom_account_names as Record<string, unknown>)
          .filter(([, v]) => typeof v === "string" && v.trim())
          .map(([k, v]) => [k, String(v)]),
      )
      : {};
    const paths = [...new Set(
      Object.values(icons)
        .map((o) => o?.facePath || o?.face_path)
        .filter((p): p is string => Boolean(p)),
    )];
    const signed: Record<string, string> = {};
    await Promise.all(paths.map(async (path) => {
      const { data: signedData } = await client.supabase.storage
        .from("account-icons")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      if (signedData?.signedUrl) signed[path] = signedData.signedUrl;
    }));
    return { icons, names, signed };
  } catch (e) {
    console.error("[credit-cards] overlays", e);
    return { icons: {}, names: {}, signed: {} };
  }
}

function overlayFor(icons: Record<string, FaceOverlay>, id: string): FaceOverlay {
  return icons[id] || icons[String(id)] || {};
}

async function fetchCreditAccounts(client: PluggyClient): Promise<Record<string, unknown>[]> {
  const chunks = await Promise.all(client.itemIds.map(async (iid) => {
    try {
      const [d, item] = await Promise.all([
        pluggyJson(client, "/accounts", { params: { itemId: iid } }) as Promise<{
        results?: Record<string, unknown>[];
        }>,
        pluggyJson(client, `/items/${iid}`).catch(() => null) as Promise<{
          connector?: { name?: string };
        } | null>,
      ]);
      const connectorName = item?.connector?.name ? String(item.connector.name) : "";
      return (d.results || [])
        .filter((acc) => String(acc.type).toUpperCase() === "CREDIT")
        .map((acc) => ({ ...acc, itemId: acc.itemId || iid, _connector: connectorName }));
    } catch (e) {
      console.error("[credit-cards] accounts", iid, e);
      return [] as Record<string, unknown>[];
    }
  }));
  return chunks.flat();
}

async function fetchBillsForAccount(
  client: PluggyClient,
  accountId: string,
): Promise<Record<string, unknown>[]> {
  try {
    const d = await pluggyJson(client, "/bills", { params: { accountId } }) as {
      results?: Record<string, unknown>[];
    };
    return (d.results || []).map((b) => ({ ...b, accountId: b.accountId || accountId }));
  } catch (e) {
    console.error("[credit-cards] bills", accountId, e);
    return [];
  }
}

async function fetchAllTransactionsForAccount(
  client: PluggyClient,
  accountId: string,
): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  let next: string | null = null;
  let guard = 0;
  const apiKey = await getPluggyApiKey(client.clientId, client.clientSecret);
  do {
    try {
      const url = next
        ? (next.startsWith("http") ? next : `${PLUGGY_API}${next}`)
        : `${PLUGGY_API}/v2/transactions?accountId=${encodeURIComponent(accountId)}`;
      const res = await fetch(url, { headers: { "X-API-KEY": apiKey, Accept: "application/json" } });
      if (!res.ok) break;
      const data = await res.json() as { results?: Record<string, unknown>[]; next?: string | null };
      for (const t of data.results || []) {
        results.push({ ...t, accountId: t.accountId || accountId });
      }
      next = data.next || null;
    } catch (e) {
      console.error("[credit-cards] txs", accountId, e);
      break;
    }
    guard++;
  } while (next && guard < 30);
  return results;
}

function serializeItem(tx: Record<string, unknown>, cardsById: Map<string, Record<string, unknown>>) {
  const payment = isBillPayment(tx);
  const signed = Number(signedTxAmount(tx)) || 0;
  const billing = Math.abs(Number(txBillingAmount(tx)) || 0);
  const installmentNum = Number(installmentNumberOf(tx)) || 0;
  const installmentTotal = Number(installmentTotalOf(tx)) || 0;
  const accountId = String(tx.accountId || "");
  const card = cardsById.get(accountId);
  return {
    id: String(tx.id || `${accountId}-${tx.date}-${billing}`),
    accountId,
    accountName: String(card?.marketingName || card?.name || ""),
    description: String(tx.description || "Lançamento"),
    amount: money(billing),
    isCredit: payment || String(tx.type).toUpperCase() === "CREDIT" || signed < 0,
    isPayment: Boolean(payment),
    isProjected: Boolean(tx.isProjected),
    isPending: String(tx.status || "").toUpperCase() === "PENDING",
    category: tx.category ? String(tx.category) : null,
    purchaseDate: resolvePurchaseDate(tx) ? String(resolvePurchaseDate(tx)).slice(0, 10) : null,
    installmentNumber: installmentNum > 0 ? installmentNum : null,
    installmentTotal: installmentTotal > 1 ? installmentTotal : null,
    merchantName: (tx.merchant as { businessName?: string } | undefined)?.businessName ?? null,
  };
}

function serializePeriod(
  built: {
    openDueKey: string;
    sortedDueKeys: string[];
    bills: Record<string, {
      dueMonthKey?: string;
      monthKey?: string;
      items?: Record<string, unknown>[];
      total?: number;
      dueDate?: string;
      isPaid?: boolean;
      type?: string;
      hasOfficial?: boolean;
    }>;
  },
  cardsById: Map<string, Record<string, unknown>>,
  selectedCardId: string,
) {
  const bills = (built.sortedDueKeys || []).flatMap((key) => {
    const bill = built.bills[key];
    if (!bill) return [];
    const items = (bill.items || []).filter((t) => {
      if (selectedCardId === "all") return true;
      return !t.accountId || t.accountId === selectedCardId;
    });
    return [{
      dueMonth: key,
      title: formatDueMonthTitle(key),
      type: bill.type || "PAST",
      total: money(bill.total),
      dueDate: bill.dueDate || null,
      dueDateShort: formatDueMonthShort(key, bill.dueDate),
      isPaid: Boolean(bill.isPaid),
      hasOfficial: Boolean(bill.hasOfficial),
      items: items.map((t) => serializeItem(t, cardsById)),
    }];
  });
  return {
    openDueKey: built.openDueKey || null,
    bills,
  };
}

export async function handleCreditCards(client: PluggyClient): Promise<Response> {
  const [creditCards, overlays] = await Promise.all([
    fetchCreditAccounts(client),
    loadCardFaceOverlays(client),
  ]);
  if (!creditCards.length) {
    return jsonResponse({
      cards: [],
      outstandingTotal: "0.00",
      creditLimitTotal: "0.00",
      availableLimitTotal: "0.00",
      periods: { all: { openDueKey: null, bills: [] } },
    });
  }

  const cardsById = new Map(creditCards.map((c) => [String(c.id), c]));
  const transactionsByAccount: Record<string, Record<string, unknown>[]> = {};
  const billsByAccount: Record<string, Record<string, unknown>[]> = {};

  await Promise.all(creditCards.map(async (card) => {
    const id = String(card.id);
    const [txs, bills] = await Promise.all([
      fetchAllTransactionsForAccount(client, id),
      fetchBillsForAccount(client, id),
    ]);
    transactionsByAccount[id] = txs;
    billsByAccount[id] = bills;
  }));

  const cards = creditCards.map((card) => {
    const id = String(card.id);
    const creditData = (card.creditData || {}) as {
      creditLimit?: number;
      availableCreditLimit?: number;
    };
    const summary = summarizeCardOpenBill(
      card,
      transactionsByAccount[id] || [],
      billsByAccount[id] || [],
    );
    const outstanding = Math.abs(Number(card.balance) || 0);
    const overlay = overlayFor(overlays.icons, id);
    const facePath = overlay.facePath || overlay.face_path || null;
    const cardFaceUrl = overlay.faceUrl || overlay.face_url
      || (facePath ? overlays.signed[facePath] : null)
      || null;
    const customName = overlays.names[id] || overlays.names[String(id)];
    return {
      id,
      name: String(customName || card.marketingName || card.name || "Cartão"),
      institutionName: String(card._connector || card.name || ""),
      marketingName: card.marketingName ? String(card.marketingName) : null,
      connectorName: card._connector ? String(card._connector) : null,
      iconKey: overlay.key || null,
      cardFaceUrl,
      lastFour: lastFour(card),
      outstanding: money(outstanding),
      openTotal: money(summary.openTotal),
      openDueKey: summary.openDueKey || null,
      openDueDate: summary.openDueDate || null,
      openTitle: summary.openTitle || null,
      lastPaidTotal: summary.lastPaidTotal != null ? money(summary.lastPaidTotal) : null,
      lastPaidKey: summary.lastPaidKey || null,
      lastPaidTitle: summary.lastPaidTitle || null,
      creditLimit: creditData.creditLimit != null ? money(creditData.creditLimit) : null,
      availableLimit: creditData.availableCreditLimit != null
        ? money(creditData.availableCreditLimit)
        : null,
    };
  });

  cards.sort((a, b) => Number(b.openTotal) - Number(a.openTotal) || a.name.localeCompare(b.name, "pt-BR"));

  const faceByKey = new Map<string, string>();
  for (const card of cards) {
    if (card.cardFaceUrl && card.iconKey && !faceByKey.has(card.iconKey)) {
      faceByKey.set(card.iconKey, card.cardFaceUrl);
    }
  }
  for (const card of cards) {
    if (!card.cardFaceUrl && card.iconKey) {
      card.cardFaceUrl = faceByKey.get(card.iconKey) ?? null;
    }
  }

  const outstandingTotal = creditCards.reduce((sum, c) => sum + Math.abs(Number(c.balance) || 0), 0);
  const creditLimitTotal = creditCards.reduce((sum, c) => {
    const limit = Number((c.creditData as { creditLimit?: number } | undefined)?.creditLimit) || 0;
    return sum + limit;
  }, 0);
  const availableLimitTotal = creditCards.reduce((sum, c) => {
    const data = (c.creditData || {}) as { creditLimit?: number; availableCreditLimit?: number };
    const available = data.availableCreditLimit ??
      (data.creditLimit ? data.creditLimit - Math.abs(Number(c.balance) || 0) : 0);
    return sum + (Number(available) || 0);
  }, 0);

  const allTxs = Object.values(transactionsByAccount).flat();
  const allBills = Object.values(billsByAccount).flat();
  const periods: Record<string, ReturnType<typeof serializePeriod>> = {
    all: serializePeriod(
      buildCreditCardBills({
        transactions: allTxs,
        officialBills: allBills,
        creditCards,
        selectedCardId: "all",
      }),
      cardsById,
      "all",
    ),
  };

  for (const card of creditCards) {
    const id = String(card.id);
    periods[id] = serializePeriod(
      buildCreditCardBills({
        transactions: transactionsByAccount[id] || [],
        officialBills: billsByAccount[id] || [],
        creditCards: [card],
        selectedCardId: id,
      }),
      cardsById,
      id,
    );
  }

  return jsonResponse({
    cards,
    outstandingTotal: money(outstandingTotal),
    creditLimitTotal: money(creditLimitTotal),
    availableLimitTotal: money(availableLimitTotal),
    periods,
  });
}
