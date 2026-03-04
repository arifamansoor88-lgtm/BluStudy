import { useEffect, useMemo, useState, useCallback } from "react";
import { useMsal } from "@azure/msal-react";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function useUserRecents(/* userId not needed */) {
  const { instance, accounts } = useMsal();
  const [items, setItems] = useState([]);

  const getToken = useCallback(async () => {
    const acct = instance.getActiveAccount() || accounts[0];
    const res = await instance.acquireTokenSilent({ account: acct, scopes: ["openid", "profile"] });
    return res.accessToken || res.idToken;
  }, [instance, accounts]);

  const fetchRecents = useCallback(async () => {
    try {
      const token = await getToken();
      console.log("useUserRecents: Fetching from", `${API}/api/recents?limit=8`);
      const res = await fetch(`${API}/api/recents?limit=8`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      console.log("useUserRecents: Response:", json);
      const list = Array.isArray(json?.items) ? json.items : [];
      console.log("useUserRecents: Extracted items:", list);
      setItems(list);
    } catch (e) {
      console.warn("useUserRecents failed:", e);
      setItems([]);
    }
  }, [getToken]);

  // Initial fetch
  useEffect(() => {
    let abort = false;
    (async () => {
      if (!abort) await fetchRecents();
    })();
    return () => { abort = true; };
  }, [fetchRecents]);

  // Refresh when page comes back into focus
  useEffect(() => {
    const handleFocus = () => {
      console.log("useUserRecents: Page focused, refreshing recents");
      fetchRecents();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchRecents]);

  return useMemo(() => (Array.isArray(items) ? items : []), [items]);
}
