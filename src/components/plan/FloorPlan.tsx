"use client";

import * as React from "react";
import { FURNITURE, ROOM_TYPES } from "@/lib/catalog";
import { openingsOf, partitionsOf, type Side } from "@/lib/openings";
import type { Design, Furniture, Room } from "@/lib/types";

const S = 10; // svg units per foot
const WALL = 0.75;
const PART = 0.4;
const MARGIN = 7; // ft around the footprint for dimension strings

export const fmtFt = (feet: number) => {
  const total = Math.round(feet * 12);
  const ft = Math.floor(total / 12);
  const inch = total % 12;
  return inch ? `${ft}′${inch}″` : `${ft}′`;
};

interface Props {
  design: Design;
  floor: number;
  selectedRoom?: string | null;
  selectedFurniture?: string | null;
  onSelectRoom?: (id: string | null) => void;
  onSelectFurniture?: (id: string | null) => void;
  /** Called while dragging (preview) and once more with done=true. */
  onMoveFurniture?: (id: string, x: number, y: number, done: boolean) => void;
  onDragStart?: () => void;
  showFurniture?: boolean;
  showLabels?: boolean;
  className?: string;
  title?: string;
}

function FurnitureGlyph({ item }: { item: Furniture }) {
  const spec = FURNITURE[item.kind];
  const w = spec.w * S;
  const d = spec.d * S;
  const x = -w / 2;
  const y = -d / 2;
  // Local: width along x, back of the piece at the top (−y in svg = +y in plan).
  const line = "fill-none stroke-[var(--plan-ink-2)]";
  switch (item.kind) {
    case "bed":
      return (
        <>
          <rect x={x} y={y} width={w} height={d} rx={3} className="fill-[var(--plan-paper)] stroke-[var(--plan-ink-2)]" />
          <rect x={x + 4} y={y + 4} width={w / 2 - 6} height={10} rx={3} className={line} />
          <rect x={2} y={y + 4} width={w / 2 - 6} height={10} rx={3} className={line} />
          <path d={`M${x} ${y + d * 0.42}H${x + w}`} className={line} />
          <path d={`M${x} ${y + d * 0.42}L${x + w * 0.35} ${y + d * 0.55}`} className={line} />
        </>
      );
    case "sofa":
    case "armchair":
      return (
        <>
          <rect x={x} y={y} width={w} height={d} rx={4} className="fill-[var(--plan-paper)] stroke-[var(--plan-ink-2)]" />
          <path d={`M${x + 5} ${y + 7}H${x + w - 5}M${x + 5} ${y + 7}V${y + d}M${x + w - 5} ${y + 7}V${y + d}`} className={line} />
          {item.kind === "sofa" ? <path d={`M${x + w / 3} ${y + 7}V${y + d}M${x + (2 * w) / 3} ${y + 7}V${y + d}`} className={line} /> : null}
        </>
      );
    case "dining": {
      const n = Math.max(2, Math.floor(spec.w / 2));
      return (
        <>
          {Array.from({ length: n }, (_, i) => {
            const cx = x + (w / n) * (i + 0.5);
            return (
              <React.Fragment key={i}>
                <rect x={cx - 6} y={y - 11} width={12} height={9} rx={2} className="fill-[var(--plan-paper)] stroke-[var(--plan-ink-3)]" />
                <rect x={cx - 6} y={y + d + 2} width={12} height={9} rx={2} className="fill-[var(--plan-paper)] stroke-[var(--plan-ink-3)]" />
              </React.Fragment>
            );
          })}
          <rect x={x} y={y} width={w} height={d} rx={3} className="fill-[var(--plan-paper)] stroke-[var(--plan-ink-2)]" />
        </>
      );
    }
    case "counter":
      return (
        <>
          <rect x={x} y={y} width={w} height={d} className="fill-[var(--plan-paper)] stroke-[var(--plan-ink-2)]" />
          <rect x={x + w * 0.15} y={y + 3} width={w * 0.22} height={d - 6} rx={3} className={line} />
          {[0.62, 0.78].map((t) => [0.3, 0.7].map((u) => <circle key={`${t}${u}`} cx={x + w * t} cy={y + d * u} r={2.4} className={line} />))}
        </>
      );
    case "car":
      return (
        <>
          <rect x={x} y={y} width={w} height={d} rx={14} className="fill-[var(--plan-paper)] stroke-[var(--plan-ink-2)]" />
          <rect x={x + 6} y={y + d * 0.3} width={w - 12} height={d * 0.42} rx={8} className={line} />
        </>
      );
    case "wc":
      return (
        <>
          <rect x={x} y={y} width={w} height={7} rx={2} className="fill-[var(--plan-paper)] stroke-[var(--plan-ink-2)]" />
          <ellipse cx={0} cy={y + 7 + (d - 7) / 2} rx={w / 2 - 1} ry={(d - 7) / 2} className="fill-[var(--plan-paper)] stroke-[var(--plan-ink-2)]" />
        </>
      );
    case "vanity":
      return (
        <>
          <rect x={x} y={y} width={w} height={d} className="fill-[var(--plan-paper)] stroke-[var(--plan-ink-2)]" />
          <ellipse cx={0} cy={0} rx={w * 0.3} ry={d * 0.28} className={line} />
        </>
      );
    case "plant":
      return (
        <>
          <circle r={w / 2} className="fill-[var(--plan-leaf)] stroke-[var(--plan-ink-3)]" />
          <path d={`M${-w / 3} 0H${w / 3}M0 ${-w / 3}V${w / 3}`} className="fill-none stroke-[var(--plan-ink-3)]" />
        </>
      );
    case "rug":
      return <rect x={x} y={y} width={w} height={d} rx={2} className="fill-none stroke-[var(--plan-ink-3)] [stroke-dasharray:3_3]" />;
    case "wardrobe":
      return (
        <>
          <rect x={x} y={y} width={w} height={d} className="fill-[var(--plan-paper)] stroke-[var(--plan-ink-2)]" />
          <path d={`M${x} ${y}L${x + w} ${y + d}M${0} ${y}V${y + d}`} className={line} />
        </>
      );
    default:
      return <rect x={x} y={y} width={w} height={d} rx={2} className="fill-[var(--plan-paper)] stroke-[var(--plan-ink-2)]" />;
  }
}

export function FloorPlan({ design, floor, selectedRoom, selectedFurniture, onSelectRoom, onSelectFurniture, onMoveFurniture, onDragStart, showFurniture = true, showLabels = true, className, title }: Props) {
  const fp = design.footprint;
  const svgRef = React.useRef<SVGSVGElement>(null);
  const X = (x: number) => (x - fp.x + MARGIN) * S;
  const Y = (y: number) => (fp.y + fp.d - y + MARGIN) * S; // street at the bottom
  const W = (fp.w + MARGIN * 2) * S;
  const H = (fp.d + MARGIN * 2) * S;
  const rooms = design.rooms.filter((r) => r.floor === floor);
  const openings = React.useMemo(() => openingsOf(design, floor), [design, floor]);
  const partitions = React.useMemo(() => partitionsOf(design, floor), [design, floor]);
  const furniture = design.furniture.filter((f) => f.floor === floor);
  const interactive = Boolean(onSelectRoom);

  // Exterior wall segments between openings, and the openings themselves.
  const walls: React.ReactNode[] = [];
  const marks: React.ReactNode[] = [];
  const sides: Side[] = ["front", "back", "left", "right"];
  sides.forEach((side) => {
    const along = side === "front" || side === "back";
    const s0 = along ? fp.x : fp.y;
    const s1 = along ? fp.x + fp.w : fp.y + fp.d;
    const band = side === "front" ? [fp.y, fp.y + WALL] : side === "back" ? [fp.y + fp.d - WALL, fp.y + fp.d] : side === "left" ? [fp.x, fp.x + WALL] : [fp.x + fp.w - WALL, fp.x + fp.w];
    const rect = (a: number, b: number, key: string, cls = "fill-[var(--plan-ink)]") =>
      along ? (
        <rect key={key} x={X(a)} y={Y(band[1]!)} width={(b - a) * S} height={WALL * S} className={cls} />
      ) : (
        <rect key={key} x={X(band[0]!)} y={Y(b)} width={WALL * S} height={(b - a) * S} className={cls} />
      );
    const ops = openings.filter((o) => o.side === side).sort((a, b) => a.a - b.a);
    let cursor = s0;
    ops.forEach((o, i) => {
      walls.push(rect(cursor, o.a, `${side}w${i}`));
      if (o.kind === "window" || o.kind === "glazing") {
        // Frame: two thin lines in the wall band, with a sill.
        marks.push(rect(o.a, o.b, `${side}g${i}`, "fill-[var(--plan-glass)] stroke-[var(--plan-ink)] [stroke-width:0.8]"));
        const mid = (band[0]! + band[1]!) / 2;
        marks.push(
          along ? (
            <path key={`${side}gl${i}`} d={`M${X(o.a)} ${Y(mid)}H${X(o.b)}`} className="stroke-[var(--plan-ink)] [stroke-width:0.8]" />
          ) : (
            <path key={`${side}gl${i}`} d={`M${X(mid)} ${Y(o.a)}V${Y(o.b)}`} className="stroke-[var(--plan-ink)] [stroke-width:0.8]" />
          ),
        );
      } else if (o.kind === "door") {
        const w = (o.b - o.a) * S;
        // Swing into the house.
        const inner = side === "front" ? Y(fp.y + WALL) : side === "back" ? Y(fp.y + fp.d - WALL) : 0;
        if (along) {
          const dir = side === "front" ? -1 : 1;
          marks.push(<path key={`${side}d${i}`} d={`M${X(o.a)} ${inner}V${inner + dir * w}A${w} ${w} 0 0 ${side === "front" ? 1 : 0} ${X(o.b)} ${inner}`} className="fill-none stroke-[var(--plan-ink-2)] [stroke-width:0.8]" />);
        }
      }
      cursor = o.b;
    });
    walls.push(rect(cursor, s1, `${side}end`));
  });

  // Interior partitions with door gaps and swings.
  const parts: React.ReactNode[] = [];
  partitions.forEach((p, i) => {
    const horiz = Math.abs(p.y1 - p.y0) < 0.01;
    const len = Math.hypot(p.x1 - p.x0, p.y1 - p.y0);
    const spans: Array<[number, number]> = p.door ? [[0, p.door[0]], [p.door[1], len]] : [[0, len]];
    spans.forEach(([a, b], k) => {
      if (b - a < 0.05) return;
      parts.push(
        horiz ? (
          <rect key={`${i}-${k}`} x={X(p.x0 + a)} y={Y(p.y0) - (PART * S) / 2} width={(b - a) * S} height={PART * S} className={p.glass ? "fill-[var(--plan-glass)] stroke-[var(--plan-ink)] [stroke-width:0.6]" : "fill-[var(--plan-ink)]"} />
        ) : (
          <rect key={`${i}-${k}`} x={X(p.x0) - (PART * S) / 2} y={Y(p.y0 + b)} width={PART * S} height={(b - a) * S} className={p.glass ? "fill-[var(--plan-glass)] stroke-[var(--plan-ink)] [stroke-width:0.6]" : "fill-[var(--plan-ink)]"} />
        ),
      );
    });
    if (p.door && !p.glass && p.door[1] - p.door[0] < len - 0.1 && p.door[1] - p.door[0] <= 3.7) {
      const w = (p.door[1] - p.door[0]) * S;
      if (horiz) {
        const x0 = X(p.x0 + p.door[0]);
        const y = Y(p.y0);
        parts.push(<path key={`${i}-sw`} d={`M${x0} ${y}V${y - w}A${w} ${w} 0 0 1 ${x0 + w} ${y}`} className="fill-none stroke-[var(--plan-ink-3)] [stroke-width:0.7]" />);
      } else {
        const x = X(p.x0);
        const y0 = Y(p.y0 + p.door[0]);
        parts.push(<path key={`${i}-sw`} d={`M${x} ${y0}H${x + w}A${w} ${w} 0 0 0 ${x} ${y0 - w}`} className="fill-none stroke-[var(--plan-ink-3)] [stroke-width:0.7]" />);
      }
    }
  });

  // Drag furniture.
  const drag = React.useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const toPlan = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const pt = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: pt.x / S - MARGIN + fp.x, y: fp.y + fp.d + MARGIN - pt.y / S };
  };
  const snap = (v: number) => Math.round(v * 4) / 4;
  const clampToFootprint = (item: Furniture, x: number, y: number) => {
    const spec = FURNITURE[item.kind];
    const rotated = item.rot % 180 !== 0;
    const hw = (rotated ? spec.d : spec.w) / 2;
    const hd = (rotated ? spec.w : spec.d) / 2;
    return {
      x: Math.min(fp.x + fp.w - WALL - hw, Math.max(fp.x + WALL + hw, snap(x))),
      y: Math.min(fp.y + fp.d - WALL - hd, Math.max(fp.y + WALL + hd, snap(y))),
    };
  };

  const stairs = rooms.filter((r) => r.type === "stair");
  const totalW = fp.w;
  const totalD = fp.d;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className={`af-plan select-none ${className ?? ""}`}
      role="img"
      aria-label={title ?? `Floor plan, ${rooms.length} rooms`}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || !onMoveFurniture) return;
        const p = toPlan(e.clientX, e.clientY);
        const item = design.furniture.find((f) => f.id === d.id);
        if (!p || !item) return;
        const c = clampToFootprint(item, p.x - d.dx, p.y - d.dy);
        if (!d.moved) {
          d.moved = true;
          onDragStart?.();
        }
        onMoveFurniture(d.id, c.x, c.y, false);
      }}
      onPointerUp={() => {
        const d = drag.current;
        if (d?.moved && onMoveFurniture) {
          const item = design.furniture.find((f) => f.id === d.id);
          if (item) onMoveFurniture(d.id, item.x, item.y, true);
        }
        drag.current = null;
      }}
      onClick={(e) => {
        if (e.target === svgRef.current) {
          onSelectRoom?.(null);
          onSelectFurniture?.(null);
        }
      }}
    >
      <defs>
        <pattern id="af-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V6" className="stroke-[var(--plan-ink-3)] [stroke-width:0.6]" />
        </pattern>
      </defs>
      {/* Rooms */}
      {rooms.map((room) => {
        const sel = room.id === selectedRoom;
        const tint = room.type === "void" ? "url(#af-hatch)" : sel ? "var(--plan-sel)" : ROOM_TYPES[room.type].tint;
        return (
          <rect
            key={room.id}
            x={X(room.x)}
            y={Y(room.y + room.d)}
            width={room.w * S}
            height={room.d * S}
            fill={tint}
            className={interactive ? "cursor-pointer transition-[fill] duration-200 hover:brightness-[0.98]" : undefined}
            onClick={(e) => {
              e.stopPropagation();
              onSelectFurniture?.(null);
              onSelectRoom?.(room.id);
            }}
          />
        );
      })}
      {/* Stair treads with the walking line */}
      {stairs.map((room) => {
        const n = 14;
        const treads = Array.from({ length: n + 1 }, (_, i) => room.y + 0.6 + ((room.d - 2.5) * i) / n);
        const x0 = room.x + 0.6;
        const x1 = room.x + 0.6 + Math.min(room.w - 1.2, 3.6);
        return (
          <g key={`st${room.id}`} className="pointer-events-none">
            {treads.map((y, i) => (
              <path key={i} d={`M${X(x0)} ${Y(y)}H${X(x1)}`} className="stroke-[var(--plan-ink-3)] [stroke-width:0.7]" />
            ))}
            <path d={`M${X((x0 + x1) / 2)} ${Y(treads[0]!)}V${Y(treads[n]!) + 6}`} className="stroke-[var(--plan-ink-2)] [stroke-width:0.8]" markerEnd="" />
            <path d={`M${X((x0 + x1) / 2) - 4} ${Y(treads[n]!) + 10}L${X((x0 + x1) / 2)} ${Y(treads[n]!) + 3}L${X((x0 + x1) / 2) + 4} ${Y(treads[n]!) + 10}`} className="fill-none stroke-[var(--plan-ink-2)] [stroke-width:0.8]" />
          </g>
        );
      })}
      {/* Furniture */}
      {showFurniture
        ? furniture.map((item) => {
            const sel = item.id === selectedFurniture;
            return (
              <g
                key={item.id}
                transform={`translate(${X(item.x)} ${Y(item.y)}) rotate(${-item.rot})`}
                className={onMoveFurniture ? "cursor-grab active:cursor-grabbing" : undefined}
                data-sel={sel ? "" : undefined}
                onPointerDown={(e) => {
                  if (!onMoveFurniture) return;
                  e.stopPropagation();
                  (e.currentTarget.ownerSVGElement as SVGSVGElement | null)?.setPointerCapture?.(e.pointerId);
                  const p = toPlan(e.clientX, e.clientY);
                  drag.current = { id: item.id, dx: p ? p.x - item.x : 0, dy: p ? p.y - item.y : 0, moved: false };
                  onSelectFurniture?.(item.id);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectFurniture?.(item.id);
                }}
              >
                <FurnitureGlyph item={item} />
                {sel ? <rect x={(-FURNITURE[item.kind].w * S) / 2 - 3} y={(-FURNITURE[item.kind].d * S) / 2 - 3} width={FURNITURE[item.kind].w * S + 6} height={FURNITURE[item.kind].d * S + 6} rx={3} className="fill-none stroke-[var(--plan-accent)] [stroke-width:1.2] [stroke-dasharray:4_3]" /> : null}
              </g>
            );
          })
        : null}
      {/* Walls over everything */}
      <g className="pointer-events-none">
        {walls}
        {parts}
        {marks}
        {rooms
          .filter((r) => r.id === selectedRoom)
          .map((r) => (
            <rect key="sel" x={X(r.x)} y={Y(r.y + r.d)} width={r.w * S} height={r.d * S} className="fill-none stroke-[var(--plan-accent)] [stroke-width:2]" />
          ))}
      </g>
      {/* Labels */}
      {showLabels ? (
        <g className="pointer-events-none">
          {rooms.map((room) => {
            if (room.w < 4.5 || room.d < 4) return null;
            const cx = X(room.x + room.w / 2);
            const cy = Y(room.y + room.d / 2);
            const small = room.w < 8 || room.d < 7;
            return (
              <g key={`lb${room.id}`} transform={`translate(${cx} ${cy})`}>
                <text textAnchor="middle" y={small ? 0 : -4} className="fill-[var(--plan-ink)] text-[10px] font-medium tracking-[0.01em]" style={{ fontSize: small ? 8.5 : 10.5 }}>
                  {room.name}
                </text>
                {small ? null : (
                  <text textAnchor="middle" y={10} className="fill-[var(--plan-ink-3)] font-mono" style={{ fontSize: 8 }}>
                    {fmtFt(room.w)} × {fmtFt(room.d)} · {Math.round(room.w * room.d)} ft²
                  </text>
                )}
              </g>
            );
          })}
        </g>
      ) : null}
      {/* Dimension strings: overall frontage below, depth at right. */}
      <g className="pointer-events-none fill-none stroke-[var(--plan-ink-3)] [stroke-width:0.7]">
        <path d={`M${X(fp.x)} ${Y(fp.y) + 28}H${X(fp.x + fp.w)}M${X(fp.x)} ${Y(fp.y) + 22}V${Y(fp.y) + 34}M${X(fp.x + fp.w)} ${Y(fp.y) + 22}V${Y(fp.y) + 34}`} />
        <path d={`M${X(fp.x + fp.w) + 28} ${Y(fp.y)}V${Y(fp.y + fp.d)}M${X(fp.x + fp.w) + 22} ${Y(fp.y)}H${X(fp.x + fp.w) + 34}M${X(fp.x + fp.w) + 22} ${Y(fp.y + fp.d)}H${X(fp.x + fp.w) + 34}`} />
        {[...new Set(rooms.filter((r) => Math.abs(r.y - fp.y) < 0.01).flatMap((r) => [r.x, r.x + r.w]))].map((x) => (
          <path key={`tx${x}`} d={`M${X(x) - 3} ${Y(fp.y) + 31}L${X(x) + 3} ${Y(fp.y) + 25}`} />
        ))}
      </g>
      <g className="pointer-events-none fill-[var(--plan-ink-2)] font-mono" style={{ fontSize: 9 }}>
        <text x={X(fp.x + fp.w / 2)} y={Y(fp.y) + 24} textAnchor="middle" className="fill-[var(--plan-ink-2)]">
          {fmtFt(totalW)}
        </text>
        <text transform={`translate(${X(fp.x + fp.w) + 24} ${Y(fp.y + fp.d / 2)}) rotate(-90)`} textAnchor="middle">
          {fmtFt(totalD)}
        </text>
        <text x={X(fp.x)} y={Y(fp.y) + 52} className="fill-[var(--plan-ink-3)]" style={{ fontSize: 8, letterSpacing: "0.14em" }}>
          STREET
        </text>
        <g transform={`translate(${X(fp.x) - 34} ${Y(fp.y + fp.d) + 2})`}>
          <circle r={9} className="fill-none stroke-[var(--plan-ink-3)] [stroke-width:0.7]" />
          <path d="M0 -7L3 4L0 2L-3 4Z" className="fill-[var(--plan-ink-2)]" />
          <text y={-13} textAnchor="middle" style={{ fontSize: 7 }}>
            N
          </text>
        </g>
      </g>
    </svg>
  );
}

export type { Room };
