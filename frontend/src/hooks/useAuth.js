import { useState, useCallback } from "react";
import { api } from "../api/garmin";

export function useAuth() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem("garmin_token");
    const name = localStorage.getItem("garmin_display_name");
    return token ? { token, displayName: name } : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.login(email, password);
      localStorage.setItem("garmin_token", data.token);
      localStorage.setItem("garmin_display_name", data.displayName || email);
      setUser({ token: data.token, displayName: data.displayName || email });
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    localStorage.removeItem("garmin_token");
    localStorage.removeItem("garmin_display_name");
    setUser(null);
  }, []);

  return { user, loading, error, login, logout };
}
