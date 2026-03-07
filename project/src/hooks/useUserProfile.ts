// src/hooks/useUserProfile.ts
import { useState, useEffect, useCallback } from "react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { msalInstance, protectedResources } from "../authConfig";

interface Profile {
  photo?: string;
  name?: string;
  email?: string;
  grade?: string;
  school?: string;
}

export function useUserProfile(userId: string) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Grabs a fresh access token
  const getAccessToken = useCallback(async (): Promise<string> => {
    await msalInstance.initialize();

    const accounts = msalInstance.getAllAccounts();
    const account = msalInstance.getActiveAccount() || accounts[0];
    if (!account) throw new Error("No active account—please sign in.");

    const request = { scopes: protectedResources.api.scopes, account };
    try {
      const resp = await msalInstance.acquireTokenSilent(request);
      return resp.accessToken;
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        const resp = await msalInstance.acquireTokenPopup(request);
        return resp.accessToken;
      }
      throw err;
    }
  }, []);

  // Fetches the profile via the Vite proxy at /api
  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      console.log("Profile token:", token);

      const res = await fetch(
        `/api/user/${userId}/profile`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const data = await res.json();
      setProfile(data.profile ?? data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId, getAccessToken]);

  // Updates a single field on the profile
  const updateField = useCallback(
    async (field: keyof Profile, value: any) => {
      // Optimistic update
      setProfile((p) => (p ? { ...p, [field]: value } : p));
      try {
        const token = await getAccessToken();

        const res = await fetch(
          `/api/user/${userId}/profile`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ [field]: value }),
          }
        );

        if (!res.ok) throw new Error(`Save failed: ${res.status}`);
        const updated = await res.json();
        setProfile(updated.profile ?? updated);
      } catch (e: any) {
        setError(e.message);
      }
    },
    [userId, getAccessToken]
  );

  // On mount or when userId changes, load the profile
  useEffect(() => {
    if (userId) fetchProfile();
    else setLoading(false);
  }, [userId, fetchProfile]);

  return { profile, loading, error, updateField };
}
