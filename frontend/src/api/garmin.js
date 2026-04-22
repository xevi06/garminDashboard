// In production VITE_API_URL is injected at build time by build-render.sh.
// In local dev the Vite proxy forwards /api → localhost:8000 (see vite.config.js).
const BASE_URL = import.meta.env.VITE_API_URL || "/api";

function getToken() {
  return localStorage.getItem("garmin_token");
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }

  return res.json();
}

export const api = {
  login: (email, password) =>
    apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => apiFetch("/auth/logout", { method: "POST" }),

  getCycling: (startDate, endDate) =>
    apiFetch(`/activities/cycling?start_date=${startDate}&end_date=${endDate}`),

  getRunning: (startDate, endDate) =>
    apiFetch(`/activities/running?start_date=${startDate}&end_date=${endDate}`),

  getSteps: (startDate, endDate) =>
    apiFetch(`/steps/daily?start_date=${startDate}&end_date=${endDate}`),

  getSummary: () => apiFetch("/stats/summary"),
};
