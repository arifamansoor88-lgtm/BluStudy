// src/hooks/useUserStats.js
import { useState, useEffect, useCallback } from "react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { msalInstance, protectedResources } from "../authConfig";

export function useUserStats(userId) {
  const [stats, setStats]     = useState({ streak: null, hours: null });
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(true);

  const getAccessToken = useCallback(async () => {
    await msalInstance.initialize();
    const accounts = msalInstance.getAllAccounts();
    const account  = msalInstance.getActiveAccount() || accounts[0];
    if (!account) throw new Error("No active account.");
    const req = { scopes: protectedResources.api.scopes, account };
    try {
      const resp = await msalInstance.acquireTokenSilent(req);
      return resp.accessToken;
    } catch (e) {
      if (e instanceof InteractionRequiredAuthError) {
        const resp = await msalInstance.acquireTokenPopup(req);
        return resp.accessToken;
      }
      throw e;
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    getAccessToken()
      .then((token) =>
        fetch(`${protectedResources.api.endpoint}/user/${userId}/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      )
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((data) => setStats(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId, getAccessToken]);

  return { ...stats, loading, error };
}
