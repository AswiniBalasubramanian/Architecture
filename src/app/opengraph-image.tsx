import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const alt = SITE.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The share card: the studio mark beside a drafted house, on warm paper. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#f6f3ee", color: "#1d1f1e", padding: 72, fontFamily: "Georgia, serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 640 }}>
          <div style={{ display: "flex", fontFamily: "monospace", fontSize: 22, letterSpacing: 6 }}>ARCHFORM</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ fontSize: 64, lineHeight: 1.02 }}>From a plot and a brief to a house your buyer can walk through.</div>
            <div style={{ fontSize: 26, color: "#5a5c57", fontFamily: "sans-serif" }}>Floor plans · textured 3D · finishes · buyer walkthrough</div>
          </div>
          <div style={{ display: "flex", fontFamily: "monospace", fontSize: 20, color: "#4e6151" }}>{SITE.studio}</div>
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
          <svg width="400" height="400" viewBox="0 0 200 200">
            <g fill="none" stroke="#1d1f1e" strokeWidth="2" strokeLinejoin="round">
              <path d="M40 120 L100 150 L160 120 L100 90 Z" fill="#fbfaf7" />
              <path d="M40 120 L40 80 L100 110 L100 150 Z" fill="#e6e0d5" />
              <path d="M100 150 L160 120 L160 80 L100 110 Z" fill="#eee9e0" />
              <path d="M40 80 L70 45 L130 75 L100 110 Z" fill="#b5643f" />
              <path d="M100 110 L130 75 L160 80 Z" fill="#9e5434" />
              <path d="M112 128 L112 112 L124 106 L124 122 Z" fill="#c9d5d3" />
              <path d="M138 116 L138 100 L150 94 L150 110 Z" fill="#c9d5d3" />
              <path d="M56 116 L56 100 L68 106 L68 122 Z" fill="#c9d5d3" />
            </g>
            <path d="M20 160 L100 196 L180 160" fill="none" stroke="#4e6151" strokeWidth="2" strokeDasharray="4 4" />
          </svg>
        </div>
      </div>
    ),
    size,
  );
}
