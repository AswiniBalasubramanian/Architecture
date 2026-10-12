import * as React from "react";
import clsx from "clsx";
import Link from "next/link";
import { RoleNav, UserMenu } from "../AuthGate";

type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet";
const variants: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-2 shadow-[inset_0_1px_0_#ffffff1f,0_1px_2px_#1d1f1e33]",
  secondary: "bg-card text-ink border border-line hover:border-line-strong shadow-[var(--shadow-lift)]",
  ghost: "text-ink-2 hover:bg-stone/70 hover:text-ink",
  quiet: "text-muted hover:text-ink",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: "sm" | "md" | "lg" = "md") {
  return clsx(
    "inline-flex select-none items-center justify-center gap-2 rounded-[10px] font-medium tracking-[-0.005em] transition-[background,color,border,transform,box-shadow] duration-200 ease-[var(--ease-out-soft)] active:translate-y-[1px] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-45",
    size === "sm" && "h-8 px-3 text-[13px]",
    size === "md" && "h-9 px-3.5 text-[14px]",
    size === "lg" && "h-11 px-5 text-[15px]",
    variants[variant],
  );
}

export function Button({ variant = "secondary", size = "md", className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  return <button type="button" className={clsx(buttonClass(variant, size), className)} {...props} />;
}

export function ButtonLink({ href, variant = "secondary", size = "md", className, children }: { href: string; variant?: ButtonVariant; size?: "sm" | "md" | "lg"; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={clsx(buttonClass(variant, size), className)}>
      {children}
    </Link>
  );
}

export function IconButton({ label, active, className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={clsx(
        "inline-flex size-8 items-center justify-center rounded-lg text-ink-2 transition duration-200 hover:bg-stone hover:text-ink active:scale-95 disabled:opacity-35 disabled:hover:bg-transparent",
        active && "bg-ink text-paper hover:bg-ink hover:text-paper",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={clsx("font-mono text-[11px] uppercase tracking-[0.14em] text-muted", className)}>{children}</p>;
}

export function Field({ label, hint, error, htmlFor, children, className }: { label: string; hint?: React.ReactNode; error?: string | null; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-[12px] text-clay">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "h-10 w-full rounded-[10px] border border-line bg-card px-3 text-[14px] text-ink outline-none transition placeholder:text-faint hover:border-line-strong focus:border-moss focus:ring-4 focus:ring-moss/10 aria-[invalid=true]:border-clay";

export function NumberInput({ id, value, onChange, min, max, step = 1, suffix, invalid }: { id?: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string; invalid?: boolean }) {
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        className={clsx(inputClass, "tnum pr-14 font-mono")}
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
      />
      {suffix ? <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-[12px] text-faint">{suffix}</span> : null}
    </div>
  );
}

export function Stepper({ value, onChange, min, max, label, id }: { value: number; onChange: (v: number) => void; min: number; max: number; label: string; id?: string }) {
  return (
    <div id={id} className="flex h-10 items-center justify-between rounded-[10px] border border-line bg-card px-1" role="group" aria-label={label}>
      <button type="button" className="size-8 rounded-lg text-ink-2 transition hover:bg-stone active:scale-95 disabled:opacity-30" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`Fewer ${label}`}>
        −
      </button>
      <span className="tnum font-mono text-[14px]" aria-live="polite">
        {value}
      </span>
      <button type="button" className="size-8 rounded-lg text-ink-2 transition hover:bg-stone active:scale-95 disabled:opacity-30" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`More ${label}`}>
        +
      </button>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label, size = "md" }: { value: T; options: Array<{ value: T; label: React.ReactNode; title?: string }>; onChange: (v: T) => void; label: string; size?: "sm" | "md" }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[10px] border border-line bg-sand p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-[8px] font-medium transition duration-200",
            size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-8 px-3 text-[13px]",
            value === o.value ? "bg-card text-ink shadow-[var(--shadow-lift)]" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The ARCHFORM mark: a section through a gabled house, drawn in one stroke. */
export function Logo({ className, withWord = true }: { className?: string; withWord?: boolean }) {
  return (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path d="M3.5 20.5V10.2L12 3.5l8.5 6.7v10.3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M3.5 20.5h17M9.5 20.5v-6h5v6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M12 3.5v4" stroke="#4e6151" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {withWord ? <span className="font-mono text-[13px] font-medium tracking-[0.18em]">ARCHFORM</span> : null}
    </span>
  );
}

export function SiteHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 md:px-8">
        <Link href="/" className="text-ink" aria-label="ARCHFORM home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-[14px]">
          <RoleNav />
          {right}
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-line bg-card px-1 font-mono text-[10px] text-muted">{children}</kbd>;
}
