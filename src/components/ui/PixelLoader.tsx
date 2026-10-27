import clsx from "clsx";

// The ARCHFORM mark (a section through a gabled house) as a pixel grid. The
// pixels light up in drawing order, walls, roof, base, door, then the ridge.

const CELL = 1.5; // logo units (of a 24-unit box) per pixel
type Seg = [number, number, number, number];
const OUTLINE: Seg[] = [
  [3.5, 20.5, 3.5, 10.2],
  [3.5, 10.2, 12, 3.5],
  [12, 3.5, 20.5, 10.2],
  [20.5, 10.2, 20.5, 20.5],
  [20.5, 20.5, 3.5, 20.5],
  [9.5, 20.5, 9.5, 14.5],
  [9.5, 14.5, 14.5, 14.5],
  [14.5, 14.5, 14.5, 20.5],
];
const RIDGE: Seg[] = [[12, 3.5, 12, 7.5]];

function pixelsOf(segs: Seg[], taken: Set<string>) {
  const out: Array<[number, number]> = [];
  for (const [x0, y0, x1, y1] of segs) {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.2);
    for (let i = 0; i <= steps; i++) {
      const c = Math.floor((x0 + ((x1 - x0) * i) / steps) / CELL);
      const r = Math.floor((y0 + ((y1 - y0) * i) / steps) / CELL);
      const key = `${c},${r}`;
      if (taken.has(key)) continue;
      taken.add(key);
      out.push([c, r]);
    }
  }
  return out;
}
const taken = new Set<string>();
const RIDGE_PX = pixelsOf(RIDGE, taken);
const OUTLINE_PX = pixelsOf(OUTLINE, taken);
const ALL = [...OUTLINE_PX.map((p) => ({ p, accent: false })), ...RIDGE_PX.map((p) => ({ p, accent: true }))];
const GRID = Math.ceil(24 / CELL);
const LOOP = 2.2; // seconds

/** A pixel ARCHFORM mark that draws itself, for loading states. */
export function PixelLogo({ size = 56, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox={`0 0 ${GRID} ${GRID}`} width={size} height={size} className={clsx("af-pixel-logo", className)} aria-hidden="true" shapeRendering="crispEdges">
      {ALL.map(({ p: [c, r], accent }, i) => (
        <rect
          key={`${c}-${r}`}
          x={c + 0.08}
          y={r + 0.08}
          width={0.84}
          height={0.84}
          className={clsx("af-px", accent ? "fill-moss" : "fill-ink")}
          style={{ animationDelay: `${((i / ALL.length) * LOOP * 0.55).toFixed(3)}s`, animationDuration: `${LOOP}s` }}
        />
      ))}
    </svg>
  );
}

/** Full-area loading state: the pixel mark, the word and an optional line of status. */
export function PixelLoader({ label = "Loading", fullScreen = false, className }: { label?: string; fullScreen?: boolean; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className={clsx("flex flex-col items-center justify-center gap-4", fullScreen ? "min-h-[100dvh] bg-paper" : "h-full w-full", className)}>
      <PixelLogo />
      <div className="flex flex-col items-center gap-1.5">
        <span className="font-mono text-[12px] font-medium tracking-[0.28em] text-ink">ARCHFORM</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{label}</span>
      </div>
    </div>
  );
}
