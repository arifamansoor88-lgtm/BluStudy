import { useEffect, useMemo, useState, useCallback } from "react";
import { useMsal } from "@azure/msal-react";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function useUserStats(/* userId not needed */) {
  const { instance, accounts } = useMsal();
  const [stats, setStats] = useState({ streak: 0, hours: 0 });

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
        const res = await fetch(`${API}/api/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!abort) setStats({ streak: json.streak ?? 0, hours: json.hours ?? 0 });
      } catch (e) {
        console.warn("useUserStats failed:", e);
        if (!abort) setStats({ streak: 0, hours: 0 });
      }
    })();
    return () => { abort = true; };
  }, [getToken]);

  return useMemo(() => stats, [stats]);
}
