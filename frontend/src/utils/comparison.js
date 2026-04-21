export const COMP_LABELS = {
  week: "Sem. ant.",
  month: "Mes ant.",
  year: "Año ant.",
};

export function getComparisonRange(startDate, endDate, mode) {
  if (!mode) return null;
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (mode === "week") {
    s.setDate(s.getDate() - 7);
    e.setDate(e.getDate() - 7);
  } else if (mode === "month") {
    s.setMonth(s.getMonth() - 1);
    e.setMonth(e.getMonth() - 1);
  } else if (mode === "year") {
    s.setFullYear(s.getFullYear() - 1);
    e.setFullYear(e.getFullYear() - 1);
  }
  return [s.toISOString().slice(0, 10), e.toISOString().slice(0, 10)];
}

// Returns % change from prev to curr, null if not computable
export function getDelta(curr, prev) {
  if (prev == null || prev === 0 || curr == null) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}
