import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, ExternalLink, Link2, Loader2, Share2, X } from "lucide-react";
import { createShareLink, revokeShareLink } from "../utils/shareLinks";

const ShareItemButton = ({
  itemId,
  itemLabel = "item",
  className = "",
  variant = "icon",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [shareLink, setShareLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const publicShareUrl = useMemo(() => {
    if (!shareLink?.sharePath || typeof window === "undefined") {
      return null;
    }

    return new URL(shareLink.sharePath, window.location.origin).toString();
  }, [shareLink]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const loadShareLink = async () => {
    try {
      setIsLoading(true);
      setError("");
      const link = await createShareLink(itemId);
      setShareLink(link);
    } catch (err) {
      console.error("Failed to create share link:", err);
      setError(err.message || "Failed to create share link");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = async (event) => {
    event.stopPropagation();
    setIsOpen(true);
    setCopied(false);
    await loadShareLink();
  };

  const handleClose = (event) => {
    if (event) {
      event.stopPropagation();
    }
    setIsOpen(false);
  };

  const handleCopy = async () => {
    if (!publicShareUrl) return;
    await navigator.clipboard.writeText(publicShareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleRevoke = async () => {
    if (!shareLink?.id) return;

    try {
      setIsRevoking(true);
      const revoked = await revokeShareLink(shareLink.id);
      setShareLink(revoked);
    } catch (err) {
      console.error("Failed to revoke share link:", err);
      setError(err.message || "Failed to revoke share link");
    } finally {
      setIsRevoking(false);
    }
  };

  const isRevoked = shareLink?.state?.status === "revoked";
  const modal = isOpen ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
              Private Share Link
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">
              Share this {itemLabel}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Anyone with the link can open a clean preview and copy it into
              their own workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close share dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          {isLoading ? (
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating share link...
            </div>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : publicShareUrl ? (
            <>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <Link2 className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  readOnly
                  value={publicShareUrl}
                  className="w-full min-w-0 truncate bg-transparent text-sm text-slate-700 outline-none"
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? "Copied" : "Copy link"}
                </button>
                <button
                  type="button"
                  onClick={() => window.open(publicShareUrl, "_blank", "noopener,noreferrer")}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open preview
                </button>
                {!isRevoked && (
                  <button
                    type="button"
                    onClick={handleRevoke}
                    disabled={isRevoking}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRevoking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="h-4 w-4" />
                    )}
                    Revoke link
                  </button>
                )}
              </div>
              {isRevoked && (
                <p className="mt-4 text-sm text-red-600">
                  This link has been revoked. Close and reopen Share to generate a fresh link.
                </p>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={
          variant === "inline"
            ? className || "inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            : className || "rounded-full p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition"
        }
        title={`Share ${itemLabel}`}
      >
        <Share2 className="h-4 w-4" />
        {variant === "inline" && <span>Share</span>}
      </button>

      {modal && typeof document !== "undefined"
        ? createPortal(modal, document.body)
        : null}
    </>
  );
};

export default ShareItemButton;
