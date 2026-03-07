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

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API}/api/recents?limit=8`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const list = Array.isArray(json?.items) ? json.items : [];
        if (!abort) setItems(list);
      } catch (e) {
        console.warn("useUserRecents failed:", e);
        if (!abort) setItems([]);
      }
    })();
    return () => { abort = true; };
  }, [getToken]);

  return useMemo(() => (Array.isArray(items) ? items : []), [items]);
}
