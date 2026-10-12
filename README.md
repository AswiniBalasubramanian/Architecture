# ARCHFORM — home design studio

Turn a plot and a brief into an explorable home concept, customise it, and share a buyer-ready 3D walkthrough.

**Configure → Generate → Customise → Visualise → Share → Explore**

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5192. You land on sign-in: choose **Architect** or **Client**.

- **Architect** → Projects → New project (brief, site, programme, assumptions) → three generated design directions → studio (2D plan, 3D model, finishes, light, furniture, undo/redo, versions) → Share.
- **Client** → paste the shared link (or open it directly) → project cover → 3D explorer with floor isolation, room index, finishes and a guided walkthrough.

## How it is built

| Layer | Where |
| --- | --- |
| Next.js 15 App Router, React 19, TypeScript, Tailwind v4 | `src/app` |
| Domain model: brief, rooms, furniture, materials, lighting | `src/lib/types.ts` |
| Deterministic concept generator (three zoning directions) | `src/lib/generator.ts` |
| Windows, doors and partitions shared by plan and 3D | `src/lib/openings.ts` |
| Studio state with undo/redo and versions (Zustand) | `src/lib/store.ts` |
| Editable SVG floor plan | `src/components/plan/FloorPlan.tsx` |
| Isometric construction figure (anatomy kit) | `src/components/build` |
| 3D house, site, procedural textures (R3F, Drei, postprocessing) | `src/components/three` |

The construction figure explains the pipeline: the plan is set out on a site model in SVG, a tower crane assembles the structure, the glazing lights up, and the view hands over to the live WebGL model from the same isometric angle.

## What is simulated

- **Generation** uses a deterministic template engine, not an AI service. The same brief always yields the same plan. Layouts are concepts and need an architect's and engineer's validation.
- **Sign-in** is a demo: no password, the role and name are remembered in this browser only. Real accounts need an auth service such as Supabase.
- **Storage**: projects are saved in the browser's localStorage.
- **Sharing**: a buyer link carries a compressed copy of the design in the URL fragment, so it opens on any device without a server; nothing is uploaded.
