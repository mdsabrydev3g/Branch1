import { useState } from "react";
import { Eye, EyeOff, KeyRound, LogIn, ShieldAlert, X } from "lucide-react";
import { adminLogin } from "@/lib/auth/admin-api";
import { usePerfStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Manager / Edit Mode dialog — ONE password, no email, no registration.
 *
 * The plaintext is typed once and sent straight to the same-origin `adminLogin`
 * server function; it is never stored in any client state beyond the input
 * field and is cleared on every submit. The server validates it against the
 * `ADMIN_PASSWORD` env var and answers by setting (or not) a signed HttpOnly
 * session cookie.
 */
export function AdminAuthDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const syncRole = usePerfStore((s) => s.syncRole);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  function close() {
    if (busy) return;
    setPassword("");
    setError("");
    setShowPw(false);
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return; // منع الإرسال المتكرر
    setError("");
    setBusy(true);
    try {
      const res = await adminLogin({ data: { password } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      await syncRole();
      setPassword("");
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Manager Access"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
              <LogIn className="size-[18px]" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-foreground">Manager Access</h2>
              <p className="text-2xs text-subtle">Enter Manager Password to edit data.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-card-2 hover:text-foreground disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <label className="block">
            <span className="mb-1 block text-2xs font-semibold text-muted">Password</span>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                required
                className="h-11 w-full rounded-lg border border-border bg-navy px-3 pr-10 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                disabled={busy}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 grid w-10 place-items-center text-subtle hover:text-foreground disabled:opacity-50"
              >
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </label>

          {error && (
            <p
              role="alert"
              className="flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger"
            >
              <ShieldAlert className="size-3.5 shrink-0" />
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="pressable h-11 flex-1 rounded-lg border border-border bg-card-2 text-sm font-medium text-muted hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !password}
              className={cn(
                "pressable flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground",
                (busy || !password) && "opacity-70",
              )}
            >
              {busy ? (
                <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
              ) : (
                <KeyRound className="size-4" />
              )}
              Enter
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}