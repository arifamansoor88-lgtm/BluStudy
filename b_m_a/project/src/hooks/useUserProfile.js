import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useMsal } from "@azure/msal-react";

/** Use the same base everywhere */
const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const DEFAULT_PROFILE = { photo: "", name: "", email: "", grade: "", school: "" };

const canUseStorage = () => typeof window !== "undefined" && !!window.localStorage;
const cacheKey = (userId) => `profile:${userId || "anon"}`;
const queueKey = (userId) => `profileQueue:${userId || "anon"}`;

function readCache(userId) {
  if (!canUseStorage()) return null;
  try { return JSON.parse(localStorage.getItem(cacheKey(userId)) || "null"); } catch { return null; }
}
function writeCache(userId, value) {
  if (!canUseStorage()) return;
  try { localStorage.setItem(cacheKey(userId), JSON.stringify(value)); } catch {}
}
function readQueue(userId) {
  if (!canUseStorage()) return [];
  try { return JSON.parse(localStorage.getItem(queueKey(userId)) || "[]"); } catch { return []; }
}
function writeQueue(userId, ops) {
  if (!canUseStorage()) return;
  try { localStorage.setItem(queueKey(userId), JSON.stringify(ops)); } catch {}
}
function normalize(p) {
  const x = p || {};
  return {
    photo:  typeof x.photo  === "string" ? x.photo  : "",
    name:   typeof x.name   === "string" ? x.name   : "",
    email:  typeof x.email  === "string" ? x.email  : "",
    grade:  typeof x.grade  === "string" ? x.grade  : "",
    school: typeof x.school === "string" ? x.school : "",
  };
}

/**
 * useUserProfile()
 * - GETs /api/profile (no userId param; server reads it from the token)
 * - PUTs /api/profile with partial body (e.g. { name: "X" })
 * - Optimistic cache + offline queue preserved
 */
export function useUserProfile(userId) {
  const { instance, accounts } = useMsal();
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const ctrlRef = useRef(null);

  const getToken = useCallback(async () => {
    const acct = instance.getActiveAccount() || accounts[0];
    if (!acct) throw new Error("No active account");
    try {
      const res = await instance.acquireTokenSilent({ account: acct, scopes: ["openid", "profile"] });
      return res.accessToken || res.idToken; // backend skips signature verification in dev
    } catch {
      return acct.idToken; // fallback still works with your dev validator
    }
  }, [instance, accounts]);

  // Prime from cache to avoid flash
  useEffect(() => {
    const cached = readCache(userId);
    if (cached) setProfile(normalize(cached));
  }, [userId]);

  // Fetch from backend
  useEffect(() => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const res = await fetch(`${API}/api/profile`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          signal: ctrl.signal,
        });
        if (!res.ok) {
          const t = await res.text();
          console.warn("GET /api/profile failed:", res.status, t);
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        const data = normalize(json?.data || {});
        setProfile(data);
        writeCache(userId, data);
      } catch (e) {
        if (e.name !== "AbortError") setError(e);
      } finally {
        setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [userId, getToken]);

  // Flush queued updates when online
  useEffect(() => {
    const onOnline = () => flushQueue(userId);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [userId]);

  const tryPut = useCallback(async (body) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/profile`, {
        method: "PUT", // <-- your backend supports PUT (not PATCH)
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body), // partial is fine; backend merges
      });
      return res.ok;
    } catch {
      return false;
    }
  }, [getToken]);

  async function flushQueue(uid) {
    const q = readQueue(uid);
    if (!q.length) return;
    const remaining = [];
    for (const op of q) {
      const ok = await tryPut({ [op.field]: op.value });
      if (!ok) remaining.push(op);
    }
    writeQueue(uid, remaining);
  }

  async function updateField(field, value) {
    // optimistic update + cache
    setProfile((prev) => {
      const next = normalize({ ...prev, [field]: value });
      writeCache(userId, next);
      return next;
    });

    const ok = await tryPut({ [field]: value });
    if (!ok) {
      const q = readQueue(userId);
      q.push({ field, value, ts: Date.now() });
      writeQueue(userId, q);
    } else {
      setError(null); // clear banner after a successful save
    }
  }

  return useMemo(
    () => ({ profile: normalize(profile), updateField, loading, error }),
    [profile, loading, error]
  );
}
