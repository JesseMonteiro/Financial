import { describe, expect, it } from 'vitest';
import {
  buildCreditCardBills,
  resolveOfficialBillTotal,
  seriesPurchaseDate,
} from '../src/utils/creditBillPeriod.js';

const TODAY = new Date('2026-10-03T15:00:00.000Z');

describe('closed statement totals', () => {
  it('does not add projected parcels on top of a closed official total', () => {
    const official = {
      accountId: 'amazon',
      dueDate: '2026-10-05',
      billClosingDate: '2026-09-21',
      totalAmount: 3119.34,
    };
    const items = [
      { accountId: 'amazon', amount: 1964.39, type: 'DEBIT', description: 'compras novas', date: '2026-09-01' },
      {
        accountId: 'amazon',
        amount: 1276.58,
        type: 'DEBIT',
        description: 'AMAZON BR (Parcela 10/10)',
        date: '2026-10-05',
        isProjected: true,
        creditCardMetadata: { installmentNumber: 10, totalInstallments: 10 },
      },
    ];
    expect(resolveOfficialBillTotal(official, items, {
      liftOfficialToCycleCharges: true,
      includeProjectedInOfficialTotal: true,
      statementClosed: true,
    })).toBe(3119.34);
  });

  it('still lifts a closed total when posted charges exceed it', () => {
    const official = {
      totalAmount: 80,
      dueDate: '2026-10-05',
      billClosingDate: '2026-09-21',
    };
    const items = [
      { amount: 100, type: 'DEBIT', description: 'omitida no totalAmount', date: '2026-09-10' },
    ];
    expect(resolveOfficialBillTotal(official, items, {
      liftOfficialToCycleCharges: true,
      statementClosed: true,
    })).toBe(100);
  });

  it('keeps adding projections on a draft that has not closed', () => {
    const official = { totalAmount: 100, dueDate: '2026-11-05', billClosingDate: '2026-10-21' };
    const items = [
      { amount: 40, type: 'DEBIT', description: 'vista', date: '2026-10-01' },
      {
        amount: 50,
        type: 'DEBIT',
        description: 'parcela',
        date: '2026-11-05',
        isProjected: true,
      },
    ];
    expect(resolveOfficialBillTotal(official, items, {
      liftOfficialToCycleCharges: true,
      includeProjectedInOfficialTotal: true,
      statementClosed: false,
    })).toBe(150);
  });
});

describe('installment identity', () => {
  it('walks a parcel-stamped purchaseDate back to the original purchase', () => {
    const posted = seriesPurchaseDate({
      date: '2026-09-17T03:21:24.000Z',
      creditCardMetadata: {
        installmentNumber: 1,
        totalInstallments: 12,
        purchaseDate: '2026-09-17T03:21:24.000Z',
      },
    });
    const pending = seriesPurchaseDate({
      date: '2026-10-17T00:00:00.000Z',
      creditCardMetadata: {
        installmentNumber: 2,
        totalInstallments: 12,
        purchaseDate: '2026-10-17T00:00:00.001Z',
      },
    });
    expect(pending).toBe(posted);
  });

  it('does not project a phantom 1/N for every future Nubank parcel', () => {
    const accountId = 'nu';
    const card = { id: accountId, name: 'Nubank', connectorName: 'MeuPluggy', _connector: 'MeuPluggy' };
    const txs = [
      parcel({ accountId, n: 1, total: 12, date: '2026-09-17', purchaseDate: '2026-09-17T03:21:24.000Z', status: 'POSTED' }),
      parcel({ accountId, n: 2, total: 12, date: '2026-10-17', purchaseDate: '2026-10-17T00:00:00.001Z', status: 'PENDING' }),
      parcel({ accountId, n: 3, total: 12, date: '2026-11-17', purchaseDate: '2026-11-17T00:00:00.001Z', status: 'PENDING' }),
      { id: 'other', accountId, amount: 20, type: 'DEBIT', description: 'Uber', date: '2026-09-20', status: 'POSTED' },
    ];
    const built = buildCreditCardBills({
      transactions: txs,
      officialBills: [{
        id: 'bill-oct',
        accountId,
        dueDate: '2026-10-09',
        billClosingDate: '2026-10-02',
        totalAmount: 40,
      }],
      creditCards: [card],
      selectedCardId: accountId,
      today: TODAY,
    });
    const oct = built.bills['2026-10'];
    const phantomFirst = (oct.items || []).filter(
      (t) => t.isProjected && t.creditCardMetadata?.installmentNumber === 1,
    );
    expect(oct.total).toBe(40);
    expect(phantomFirst).toHaveLength(0);
  });

  it('counts one Inter parcel when Pluggy posts two descriptions', () => {
    const accountId = 'inter';
    const card = { id: accountId, name: 'Inter', connectorName: 'MeuPluggy', _connector: 'MeuPluggy' };
    const shared = {
      accountId,
      amount: 159.7,
      type: 'DEBIT',
      status: 'POSTED',
      date: '2026-09-09T03:00:00.000Z',
      billId: 'bill-oct',
      creditCardMetadata: {
        installmentNumber: 7,
        totalInstallments: 10,
        purchaseDate: '2026-03-30T00:00:00.000Z',
        cardNumber: '5134',
      },
    };
    const built = buildCreditCardBills({
      transactions: [
        { ...shared, id: 'a', description: 'parcela shopping inter' },
        { ...shared, id: 'b', description: 'cp parc shopping inter' },
      ],
      officialBills: [{
        id: 'bill-oct',
        accountId,
        dueDate: '2026-10-07',
        billClosingDate: '2026-09-30',
        totalAmount: 159.7,
      }],
      creditCards: [card],
      selectedCardId: accountId,
      today: TODAY,
    });
    expect(built.bills['2026-10'].total).toBe(159.7);
  });
});

function parcel({ accountId, n, total, date, purchaseDate, status }) {
  return {
    id: `vivo-${n}`,
    accountId,
    amount: 20,
    type: 'DEBIT',
    status,
    description: 'Lite *Vivo Anual',
    date: `${date}T12:00:00.000Z`,
    creditCardMetadata: {
      installmentNumber: n,
      totalInstallments: total,
      purchaseDate,
    },
  };
}
