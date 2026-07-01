import React, { createContext, useContext, useState, useCallback } from "react";

const GuestContext = createContext({ isGuest: false, enterGuest: () => {}, exitGuest: () => {} });

export function GuestProvider({ children }) {
  const [isGuest, setIsGuest] = useState(
    () => sessionStorage.getItem("blugst") === "1"
  );

  const enterGuest = useCallback(() => {
    sessionStorage.setItem("blugst", "1");
    setIsGuest(true);
  }, []);

  const exitGuest = useCallback(() => {
    sessionStorage.removeItem("blugst");
    setIsGuest(false);
  }, []);

  return (
    <GuestContext.Provider value={{ isGuest, enterGuest, exitGuest }}>
      {children}
    </GuestContext.Provider>
  );
}

export function useGuest() {
  return useContext(GuestContext);
}

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export async function guestFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}
