import React from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { useGuest } from "../context/GuestContext";

export default function GuestBanner() {
  const { isGuest, exitGuest } = useGuest();
  const navigate = useNavigate();

  if (!isGuest) return null;

  const handleSignUp = () => {
    exitGuest();
    navigate("/signin");
  };

  return (
    <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Sparkles className="h-4 w-4 flex-shrink-0 text-primary-200" />
        <span className="text-primary-100 whitespace-normal">
          You're exploring as a guest. Unlock more tools and save your work by creating an account.
        </span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
        <button
          onClick={handleSignUp}
          className="px-3 py-1 rounded-lg bg-white text-primary-700 text-xs font-semibold hover:bg-primary-50 transition-colors"
        >
          Create free account
        </button>
        <button
          onClick={() => { exitGuest(); navigate("/"); }}
          className="p-1 rounded text-primary-200 hover:text-white transition-colors"
          title="Exit guest mode"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
