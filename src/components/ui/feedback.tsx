"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { clsx } from "clsx";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Avisos de la app: toasts y confirmaciones.
 *
 * Sustituye a `window.confirm()`, que no se puede estilizar, ignora el tema
 * claro/oscuro, aparece pegado al chrome del navegador (en un teléfono ni
 * siquiera cerca del botón que lo disparó) y bloquea el hilo principal
 * mientras está abierto.
 */

// ---------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milisegundos en pantalla. 0 = no se cierra solo. */
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastOptions, "description">> {
  id: number;
  description?: string;
}

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" pinta el botón principal en rojo (borrar, desactivar…). */
  tone?: "danger" | "default";
}

interface FeedbackContextValue {
  toast: (options: ToastOptions) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

// Los errores se quedan más tiempo: suelen traer algo que leer y decidir.
const DURACION_POR_TONO: Record<ToastTone, number> = {
  success: 3500,
  info: 4000,
  warning: 6000,
  error: 7000,
};

const ICONO_POR_TONO = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const ESTILO_POR_TONO: Record<ToastTone, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  error: "text-rose-600 dark:text-rose-400",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-sky-600 dark:text-sky-400",
};

const BARRA_POR_TONO: Record<ToastTone, string> = {
  success: "bg-emerald-500",
  error: "bg-rose-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
};

// ---------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);

  const siguienteId = useRef(0);
  const temporizadores = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const resolverConfirm = useRef<((valor: boolean) => void) | null>(null);

  const dismiss = useCallback((id: number) => {
    const t = temporizadores.current.get(id);
    if (t) {
      clearTimeout(t);
      temporizadores.current.delete(id);
    }
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, tone = "info", duration }: ToastOptions) => {
      const id = siguienteId.current++;
      const ms = duration ?? DURACION_POR_TONO[tone];

      setToasts((prev) => {
        // Tope de 4 en pantalla: en una sincronización offline pueden
        // dispararse muchos seguidos y taparían la app entera.
        const siguiente = [...prev, { id, title, description, tone, duration: ms }];
        return siguiente.slice(-4);
      });

      if (ms > 0) {
        temporizadores.current.set(
          id,
          setTimeout(() => dismiss(id), ms)
        );
      }
    },
    [dismiss]
  );

  // Se limpian los temporizadores pendientes al desmontar para no llamar a
  // setState sobre un componente que ya no existe.
  useEffect(() => {
    const pendientes = temporizadores.current;
    return () => {
      pendientes.forEach((t) => clearTimeout(t));
      pendientes.clear();
    };
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        // Si ya había una confirmación abierta se resuelve en negativo para
        // no dejar la promesa anterior colgada para siempre.
        resolverConfirm.current?.(false);
        resolverConfirm.current = resolve;
        setConfirmState(options);
      }),
    []
  );

  const cerrarConfirm = useCallback((resultado: boolean) => {
    resolverConfirm.current?.(resultado);
    resolverConfirm.current = null;
    setConfirmState(null);
  }, []);

  const value = useMemo<FeedbackContextValue>(
    () => ({
      toast,
      success: (title, description) => toast({ title, description, tone: "success" }),
      error: (title, description) => toast({ title, description, tone: "error" }),
      warning: (title, description) => toast({ title, description, tone: "warning" }),
      info: (title, description) => toast({ title, description, tone: "info" }),
      confirm,
    }),
    [toast, confirm]
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      {confirmState && <ConfirmDialog options={confirmState} onClose={cerrarConfirm} />}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error("useFeedback debe usarse dentro de <FeedbackProvider>. Revisa src/app/layout.tsx.");
  }
  return ctx;
}

// ---------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------

function ToastViewport({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    // En móvil van abajo pero POR ENCIMA de la barra de navegación fija
    // (h-16 + safe area), si no quedarían tapados justo donde está el pulgar.
    // En escritorio, arriba a la derecha, fuera del contenido.
    <div
      aria-live="polite"
      aria-label="Notificaciones"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:inset-x-auto md:bottom-auto md:right-4 md:top-4 md:items-end md:px-0"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const Icono = ICONO_POR_TONO[toast.tone];

  return (
    <div
      // Un error interrumpe al lector de pantalla; el resto sólo se anuncia
      // cuando haya una pausa.
      role={toast.tone === "error" ? "alert" : "status"}
      className="card animate-fade-in-up pointer-events-auto relative w-full max-w-sm overflow-hidden p-3.5 pr-10 shadow-lg"
    >
      <span className={clsx("absolute inset-y-0 left-0 w-1", BARRA_POR_TONO[toast.tone])} />
      <div className="flex items-start gap-2.5 pl-1.5">
        <Icono className={clsx("mt-0.5 h-4.5 w-4.5 shrink-0", ESTILO_POR_TONO[toast.tone])} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{toast.title}</p>
          {toast.description && (
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--foreground-muted)]">
              {toast.description}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar notificación"
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------
// Confirmación
// ---------------------------------------------------------------------

function ConfirmDialog({
  options,
  onClose,
}: {
  options: ConfirmOptions;
  onClose: (resultado: boolean) => void;
}) {
  const confirmarRef = useRef<HTMLButtonElement>(null);
  const dialogoRef = useRef<HTMLDivElement>(null);
  const esPeligro = options.tone === "danger";

  useEffect(() => {
    // Se recuerda quién tenía el foco para devolvérselo al cerrar; si no,
    // el foco vuelve al <body> y quien navega con teclado tiene que
    // recorrer la página entera para retomar donde estaba.
    const elementoPrevio = document.activeElement as HTMLElement | null;
    confirmarRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose(false);
        return;
      }

      // Trampa de foco: en un diálogo modal, tabular no debe llevar detrás
      // del fondo, donde no se ve lo que está enfocado.
      if (event.key !== "Tab") return;

      const focuseables = dialogoRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focuseables || focuseables.length === 0) return;

      const primero = focuseables[0];
      const ultimo = focuseables[focuseables.length - 1];

      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    // Se bloquea el scroll del fondo mientras el diálogo está abierto.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflowPrevio;
      elementoPrevio?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancelar"
        tabIndex={-1}
        className="absolute inset-0 bg-black/50"
        onClick={() => onClose(false)}
      />
      <div
        ref={dialogoRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-titulo"
        aria-describedby={options.description ? "confirm-descripcion" : undefined}
        className="card animate-fade-in-up relative w-full max-w-sm p-5"
      >
        <div className="flex items-start gap-3">
          <div
            className={clsx(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              esPeligro ? "bg-rose-500/15 text-rose-500" : "bg-sky-500/15 text-sky-500"
            )}
          >
            {esPeligro ? <AlertTriangle className="h-5 w-5" /> : <Info className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <h2 id="confirm-titulo" className="font-semibold leading-snug">
              {options.title}
            </h2>
            {options.description && (
              <p id="confirm-descripcion" className="mt-1 text-sm text-[var(--foreground-muted)]">
                {options.description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" className="justify-center" onClick={() => onClose(false)}>
            {options.cancelLabel ?? "Cancelar"}
          </Button>
          <Button
            ref={confirmarRef}
            variant={esPeligro ? "danger" : "primary"}
            className="justify-center"
            onClick={() => onClose(true)}
          >
            {options.confirmLabel ?? "Confirmar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
