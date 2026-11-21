// Sin dependencias de servidor: lo usan la página, los componentes cliente y los tests.
export const DASHBOARD_PERIODS = [7, 30, 90] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];
export const DEFAULT_PERIOD: DashboardPeriod = 30;
export const DASHBOARD_TIME_ZONE = "America/Argentina/Buenos_Aires";

export type DashboardQuery = { periodo: DashboardPeriod };

// shortcut: Buenos Aires fija en UTC−3 (Argentina no usa horario de verano), si cambia la regla, pasar a Intl.
const BA_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDashboardParams(
  params: Record<string, string | string[] | undefined>,
): DashboardQuery {
  const raw = params.periodo; // un `periodo` repetido (array) cae al default
  return { periodo: DASHBOARD_PERIODS.find((p) => String(p) === raw) ?? DEFAULT_PERIOD };
}

// Omite de la URL el valor por defecto.
export function dashboardHref({ periodo }: DashboardQuery): string {
  return periodo === DEFAULT_PERIOD ? "/admin" : `/admin?periodo=${periodo}`;
}

export type DashboardRange = {
  period: DashboardPeriod;
  from: Date; // 00:00 Buenos Aires de hace period − 1 días
  to: Date; // ahora
  prevFrom: Date; // from − period días; el anterior es [prevFrom, from)
  bucket: "day" | "week"; // "week" solo con 90
};

export function dashboardRange(period: DashboardPeriod, now: Date = new Date()): DashboardRange {
  const ba = new Date(now.getTime() - BA_OFFSET_MS);
  const todayStartUtc = Date.UTC(ba.getUTCFullYear(), ba.getUTCMonth(), ba.getUTCDate());
  const from = new Date(todayStartUtc - (period - 1) * DAY_MS + BA_OFFSET_MS);
  return {
    period,
    from,
    to: now,
    prevFrom: new Date(from.getTime() - period * DAY_MS),
    bucket: period === 90 ? "week" : "day",
  };
}

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// Claves "YYYY-MM-DD" (calendario de Buenos Aires) de cada día, o de cada lunes con "week".
export function bucketKeys(range: DashboardRange): string[] {
  // Medianoche UTC con la fecha local de Buenos Aires de `from` y de `to`.
  const start = Date.parse(dayKey(range.from.getTime() - BA_OFFSET_MS));
  const end = Date.parse(dayKey(range.to.getTime() - BA_OFFSET_MS));
  const keys: string[] = [];
  if (range.bucket === "day") {
    for (let t = start; t <= end; t += DAY_MS) keys.push(dayKey(t));
    return keys;
  }
  const sinceMonday = (new Date(start).getUTCDay() + 6) % 7;
  for (let t = start - sinceMonday * DAY_MS; t <= end; t += 7 * DAY_MS) keys.push(dayKey(t));
  return keys;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function bucketLabel(key: string, bucket: "day" | "week"): string {
  const [, month, day] = key.split("-").map(Number);
  const label = `${day} ${MONTHS[month - 1]}`;
  return bucket === "week" ? `Sem. ${label}` : label;
}

export type Change = { kind: "up" | "down"; pct: number } | { kind: "same" } | { kind: "new" };

export function percentChange(current: number, previous: number): Change {
  if (previous === 0) return current > 0 ? { kind: "new" } : { kind: "same" };
  const pct = Math.round((Math.abs(current - previous) / previous) * 100);
  if (current === previous || pct === 0) return { kind: "same" };
  return { kind: current > previous ? "up" : "down", pct };
}
