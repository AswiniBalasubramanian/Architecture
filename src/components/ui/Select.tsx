"use client";

import * as React from "react";
import clsx from "clsx";
import { CaretDown, Check } from "@phosphor-icons/react";

export interface SelectOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Plain text for typeahead and the accessible name, when the label isn't a string. */
  text?: string;
  /** Options with the same group are listed under one heading, in order of first appearance. */
  group?: string;
  disabled?: boolean;
}

/**
 * The studio's dropdown: a button that opens a listbox in the paper-and-moss
 * theme. Keyboard: arrows, Home/End, Enter/Space to pick, Escape to close,
 * and typing a letter jumps to the next matching option.
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  id,
  size = "md",
  disabled,
  className,
  invalid,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<SelectOption<T>>;
  /** Accessible name when there is no visible <label for={id}>. */
  label?: string;
  id?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  invalid?: boolean;
}) {
  const autoId = React.useId();
  const listId = `${id ?? autoId}-list`;
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [up, setUp] = React.useState(false);
  const root = React.useRef<HTMLDivElement>(null);
  const button = React.useRef<HTMLButtonElement>(null);
  const list = React.useRef<HTMLUListElement>(null);
  const typed = React.useRef({ text: "", at: 0 });

  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[index];
  const textOf = (o: SelectOption<T>) => o.text ?? (typeof o.label === "string" ? o.label : String(o.value));

  const show = () => {
    if (disabled) return;
    const r = button.current?.getBoundingClientRect();
    // Open upward when there isn't room below.
    setUp(Boolean(r && window.innerHeight - r.bottom < 280 && r.top > window.innerHeight - r.bottom));
    setActive(index);
    setOpen(true);
  };
  const close = (focus = true) => {
    setOpen(false);
    if (focus) button.current?.focus();
  };
  const pick = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    onChange(o.value);
    close();
  };
  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) if (!options[i]!.disabled) return i;
    return from;
  };

  React.useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  React.useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);
  React.useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") e.preventDefault();
      close(e.key === "Escape");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => step(a, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => step(a, -1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(step(-1, 1));
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(step(options.length, -1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(active);
    } else if (e.key.length === 1) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
      const q = typed.current.text;
      const order = [...options.keys()].map((k) => (active + 1 + k) % options.length);
      const hit = order.find((i) => !options[i]!.disabled && textOf(options[i]!).toLowerCase().startsWith(q));
      if (hit !== undefined) setActive(hit);
    }
  };

  let lastGroup: string | undefined;
  return (
    <div ref={root} className={clsx("relative", className)}>
      <button
        ref={button}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid || undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={onKey}
        className={clsx(
          "flex w-full items-center justify-between gap-2 rounded-[10px] border bg-card text-left text-ink outline-none transition",
          "hover:border-line-strong focus-visible:border-moss focus-visible:ring-4 focus-visible:ring-moss/10 disabled:cursor-not-allowed disabled:opacity-50",
          open ? "border-moss ring-4 ring-moss/10" : invalid ? "border-clay" : "border-line",
          size === "sm" ? "h-9 px-3 text-[13px]" : "h-10 px-3 text-[14px]",
        )}
      >
        <span className="truncate">{current ? current.label : ""}</span>
        <CaretDown size={12} weight="bold" className={clsx("shrink-0 text-muted transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open ? (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onKey}
          className={clsx(
            "af-pop absolute left-0 z-40 max-h-[264px] min-w-full overflow-y-auto overscroll-contain rounded-xl border border-line bg-card p-1 shadow-[var(--shadow-lift),0_18px_40px_-16px_#1d1f1e33] outline-none",
            up ? "bottom-full mb-1.5 origin-bottom" : "top-full mt-1.5 origin-top",
          )}
        >
          {options.map((o, i) => {
            const heading = o.group && o.group !== lastGroup ? o.group : null;
            lastGroup = o.group;
            const selected = o.value === value;
            return (
              <React.Fragment key={o.value}>
                {heading ? <li role="presentation" className="px-2.5 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{heading}</li> : null}
                <li
                  id={`${listId}-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={selected}
                  aria-disabled={o.disabled || undefined}
                  onPointerEnter={() => !o.disabled && setActive(i)}
                  onClick={() => pick(i)}
                  className={clsx(
                    "flex cursor-pointer items-center justify-between gap-3 whitespace-nowrap rounded-lg px-2.5 py-2 transition-colors",
                    size === "sm" ? "text-[13px]" : "text-[14px]",
                    o.disabled ? "cursor-not-allowed text-faint" : i === active ? "bg-sand text-ink" : "text-ink-2",
                    selected && "font-medium text-ink",
                  )}
                >
                  <span>{o.label}</span>
                  {selected ? <Check size={13} weight="bold" className="text-moss" /> : <span className="size-[13px]" />}
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
