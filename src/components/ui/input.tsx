import { InputHTMLAttributes, forwardRef, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { clsx } from "clsx";

// `min-w-0` es necesario para que estos campos puedan encogerse dentro de
// un grid: por defecto un hijo de grid tiene `min-width: auto`, así que un
// input (sobre todo `type="date"`, que trae un ancho intrínseco grande)
// desborda la columna en pantallas chicas en vez de adaptarse.
//
// El texto es de 16px en móvil a propósito: Safari en iOS hace zoom
// automático al enfocar un campo con fuente menor a 16px, y el usuario se
// queda con la página ampliada a media captura.
const fieldBase =
  "w-full min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 h-11 text-base sm:text-[15px] text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-sky-400/60 focus:border-sky-400 disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={clsx(fieldBase, className)} {...props} />
  )
);
Input.displayName = "Input";

/** Teclas que producirían un valor negativo o en notación científica. */
const TECLAS_BLOQUEADAS = ["-", "+", "e", "E"];

export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Permite decimales (por defecto sí). En false sólo se aceptan enteros. */
  decimales?: boolean;
}

/**
 * Campo numérico que no deja escribir cantidades negativas.
 *
 * `min="0"` por sí solo no basta: el navegador lo comprueba al enviar el
 * formulario, no al teclear, así que el usuario alcanza a escribir "-50",
 * ve el número en pantalla y sólo se entera del problema al guardar. Aquí
 * se bloquean el signo y el pegado de valores negativos en el momento.
 *
 * Además:
 *   - `inputMode="decimal"` abre el teclado numérico en el teléfono.
 *   - La rueda del ratón se ignora: con el cursor sobre un `type="number"`
 *     enfocado, hacer scroll en la página cambia el valor sin que nadie se
 *     dé cuenta.
 *
 * Nada de esto sustituye la validación: el esquema zod y la base de datos
 * siguen siendo los que mandan (esto es sólo comodidad de captura).
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, decimales = true, onKeyDown, onPaste, onWheel, ...props }, ref) => (
    <input
      ref={ref}
      type="number"
      inputMode={decimales ? "decimal" : "numeric"}
      min={props.min ?? 0}
      step={props.step ?? (decimales ? "0.01" : "1")}
      className={clsx(fieldBase, className)}
      onKeyDown={(event) => {
        if (TECLAS_BLOQUEADAS.includes(event.key)) event.preventDefault();
        if (!decimales && (event.key === "." || event.key === ",")) event.preventDefault();
        onKeyDown?.(event);
      }}
      onPaste={(event) => {
        const texto = event.clipboardData.getData("text").trim().replace(",", ".");
        const n = Number(texto);
        if (!Number.isFinite(n) || n < 0 || (!decimales && !Number.isInteger(n))) {
          event.preventDefault();
        }
        onPaste?.(event);
      }}
      onWheel={(event) => {
        event.currentTarget.blur();
        onWheel?.(event);
      }}
      {...props}
    />
  )
);
NumberInput.displayName = "NumberInput";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={clsx(fieldBase, "pr-8", className)} {...props}>
      {children}
    </select>
  )
);
Select.displayName = "Select";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={clsx(fieldBase, "h-auto min-h-24 py-2.5 resize-none", className)}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  /** Para colocar el campo dentro de un grid (p. ej. "col-span-2"). */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    // `min-w-0` para que el campo pueda encogerse cuando el Field es hijo
    // directo de un grid (ver nota en fieldBase).
    <div className={clsx("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-[var(--foreground)]">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-[var(--foreground-muted)]">{hint}</p>}
      {error && <p className="text-xs font-medium text-rose-500">{error}</p>}
    </div>
  );
}
