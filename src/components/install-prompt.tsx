"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "ice-t:install-dismissed-at";
const DISMISS_DAYS = 14;

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      const daysSince = (Date.now() - dismissedAt) / 86_400_000;
      if (dismissedAt && daysSince < DISMISS_DAYS) return;
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible || !deferred) return null;

  return (
    <div className="safe-bottom fixed inset-x-3 bottom-20 z-40 md:bottom-4 md:left-auto md:right-4 md:w-80">
      <div className="card flex items-center gap-3 p-3.5 shadow-xl animate-fade-in-up">
        <div className="brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Instala Ice-T</p>
          <p className="text-xs text-[var(--foreground-muted)]">Accede más rápido, incluso sin conexión.</p>
        </div>
        <button
          onClick={async () => {
            setVisible(false);
            await deferred.prompt();
            setDeferred(null);
          }}
          className="brand-gradient shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
        >
          Instalar
        </button>
        <button
          aria-label="Cerrar"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, String(Date.now()));
            setVisible(false);
          }}
          className="shrink-0 text-[var(--foreground-muted)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
