import { useEffect, useMemo, useState, useCallback } from "react";
import { useMsal } from "@azure/msal-react";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const LOCAL_RECENTS_KEY = "ai_education_recent_tools";

function readLocalRecents() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_RECENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("useUserRecents: failed to read local recents", e);
    return [];
  }
}

function saveLocalRecents(recents) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_RECENTS_KEY, JSON.stringify(recents.slice(0, 8)));
  } catch (e) {
    console.warn("useUserRecents: failed to save local recents", e);
  }
}

export function addLocalRecentTool(tool) {
  try {
    if (!tool || !tool.to || !tool.title) return;
    const existing = readLocalRecents();
    const normalized = existing.filter((item) => item.route !== tool.to);
    const newItem = {
      id: `tool:${tool.to}`,
      title: tool.title,
      contentType: "tool",
      route: tool.to,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const merged = [newItem, ...normalized].slice(0, 8);
    saveLocalRecents(merged);
    return merged;
  } catch (e) {
    console.warn("addLocalRecentTool failed", e);
    return readLocalRecents();
  }
}

export function useUserRecents(/* userId not needed */) {
  const { instance, accounts } = useMsal();
  const [items, setItems] = useState([]);
  const [localItems, setLocalItems] = useState(() => readLocalRecents());

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

  // Keep local recents in sync across tabs
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === LOCAL_RECENTS_KEY) {
        setLocalItems(readLocalRecents());
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return useMemo(() => {
    const fetched = Array.isArray(items) ? items : [];
    const local = Array.isArray(localItems) ? localItems : [];

    const merged = [...local, ...fetched].filter((item) => item?.contentType !== "tool");

    const unique = new Map();
    merged.forEach((item) => {
      const key = item.id || item.route || item.title;
      const existing = unique.get(key);
      const existingDate = existing ? new Date(existing.updatedAt || existing.createdAt || 0) : null;
      const thisDate = new Date(item.updatedAt || item.createdAt || 0);

      if (!existing || thisDate > existingDate) {
        unique.set(key, item);
      }
    });

    return Array.from(unique.values()).
      sort((a, b) => {
        const aDate = new Date(a.updatedAt || a.createdAt || 0);
        const bDate = new Date(b.updatedAt || b.createdAt || 0);
        return bDate - aDate;
      })
      .slice(0, 8);
  }, [items, localItems]);
}
