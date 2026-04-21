export function formatPace(paceMinKm) {
  if (!paceMinKm) return "—";
  const min = Math.floor(paceMinKm);
  const sec = Math.round((paceMinKm - min) * 60);
  return `${min}:${sec.toString().padStart(2, "0")} /km`;
}

export function formatDuration(minutes) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

export function formatNumber(n, decimals = 0) {
  if (n == null) return "—";
  return Number(n).toLocaleString("es-ES", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function paceLabel(val) {
  if (!val) return "—";
  const min = Math.floor(val);
  const sec = Math.round((val - min) * 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}
