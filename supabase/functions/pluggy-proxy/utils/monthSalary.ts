/**
 * Monthly salary helpers for Momento Financeiro.
 * Stored on profiles.monthly_salaries (same as the web app).
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

export const SALARY_DEFAULT_FALLBACK = 5000;

export async function getMonthlySalaries(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("monthly_salaries")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("[monthSalary] Failed to fetch:", error);
      return {};
    }

    const raw = data?.monthly_salaries;
    if (!raw || typeof raw !== "object") return {};
    return raw as Record<string, number>;
  } catch (error) {
    console.error("[monthSalary] Exception fetching:", error);
    return {};
  }
}

export async function saveMonthlySalaries(
  supabase: SupabaseClient,
  userId: string,
  salaries: Record<string, number>,
): Promise<void> {
    const { error } = await supabase
    .from("profiles")
    .update({ monthly_salaries: salaries })
    .eq("id", userId);

    if (error) {
    console.error("[monthSalary] Failed to save:", error);
    throw error;
  }
}

export function resolveMonthSalary(
  salaries: Record<string, number> = {},
  ym: string,
  fallback = SALARY_DEFAULT_FALLBACK,
): number {
  if (!ym) return fallback;
  
  if (salaries[ym] !== undefined && salaries[ym] !== null && salaries[ym] !== ("" as unknown)) {
    return Number(salaries[ym]) || 0;
  }
  
  if (
    salaries._default !== undefined &&
    salaries._default !== null &&
    salaries._default !== ("" as unknown)
  ) {
    return Number(salaries._default) || 0;
  }
  
  const prior = Object.keys(salaries)
    .filter((k) => /^\d{4}-\d{2}$/.test(k) && k < ym)
    .sort();
    
  if (prior.length) {
    return Number(salaries[prior[prior.length - 1]]) || 0;
  }
  
  return fallback;
}

export function withSavedMonthSalary(
  salaries: Record<string, number> = {},
  ym: string,
  amount: number,
): Record<string, number> {
  const num = Number(amount) || 0;
  return {
    ...salaries,
    [ym]: num,
    _default: num,
  };
}
