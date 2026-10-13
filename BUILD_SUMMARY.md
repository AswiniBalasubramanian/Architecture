# ARCHFORM — Build Summary

**Live:** https://studioarchitecturebyaswini.vercel.app · **Repo:** https://github.com/AswiniBalasubramanian/Architecture · **Vercel project:** `studio_architecture_byaswini`
**Studio:** Studio Ash & Builders · **Stack:** Next.js 15 · React 19 · TypeScript · Tailwind v4 · Zustand · Three.js (R3F 9 + Drei 10 + postprocessing) · Phosphor icons · Geist + Instrument Serif

---

## What it does

A web studio that turns a plot and a brief into an explorable home concept, then shares it with buyers.

**Configure → Generate → Customise → Visualise → Share → Explore**

| Route | Who | Purpose |
| --- | --- | --- |
| `/login` | everyone | Choose **Architect** or **Client** (demo sign-in) |
| `/about` | public | Marketing page, workflow, finishes, FAQ |
| `/projects` | architect | Saved projects, sample project, delete |
| `/new` | architect | Brief: site, area, type, rooms, budget, requirements, setbacks |
| `/p/[id]/generate` | architect | Three design directions + construction animation → 3D |
| `/p/[id]/studio` | architect | Plan · Split · 3D studio with properties panel |
| `/client` | client | Paste a shared link, reopen recent projects |
| `/view#…` | client / architect | Buyer cover → 3D explorer → guided tour |

---

## Features

### Project setup
- Plot frontage/depth, built-up area, floors (1–3), bedrooms, bathrooms, budget + currency, location
- House types: villa, duplex, contemporary, traditional, compact
- Requirements: parking, study, prayer room, utility, garden-facing living, roof terrace, family lounge
- Editable assumptions: front/rear/side setbacks, floor-to-floor height
- Live plot diagram, title-block summary (footprint, coverage, budget/sq ft), inline validation

### Concept generation
- Deterministic template engine, not an AI service: the same brief always gives the same plan
- Three zoning directions: **Open Linear**, **Central Core**, **Courtyard**
- Stair core aligned on every floor; rooms tile each floor exactly
- Property-tested on 1,350 briefs with 0 tiling failures

### Construction animation (`/anatomy` skill)
- Isometric site model on a baseboard: ruler, label plate, north point, street, plot wall, trees
- A tower crane slews, trolleys and lowers each piece in build order: setting out → footings → plinth → columns → walls with recessed windows → slabs → roof → glazing lights up
- Pipeline indicator **SVG plan → Structure → WebGL light → 3D model**, then hands over to the live 3D view from the same isometric angle
- Scrub with pointer or arrow keys; respects reduced motion

### 2D plan (SVG)
- Poché walls cut at real openings, windows, door swings, stairs, dimension strings, room areas, north point
- Click to select rooms; drag furniture (snapped, kept inside walls)

### 3D model (WebGL)
- Built from the same rooms and openings as the plan, so 2D and 3D always agree
- Procedural textures with height maps: brick, stone, board-formed concrete, timber, tile, terracotta, metal, marble, grass, asphalt, paving
- Detail: framed and divided windows, stone sills with drips, chajjas, curtains, panelled door, wall lights, house number, entrance steps, car ramp, gutters, fascia, soffits, downpipes, ridge and hip caps, water tank, solar array, stair balustrade, pendant lights
- Furniture: beds with bedside lamps, cushioned sofas, dining sets, kitchens with backsplash, sink and tap, wardrobes, desks, a car with tyres, glass and lights
- Site: compound wall with coping, barred gate, lamp piers, street lamps, kerbs, shrubs, clustered trees
- Rendering: sun by time of day, sky, PCF shadows, studio environment reflections, ambient occlusion (N8AO), bloom at night, ACES tone mapping, SMAA
- Camera presets, cutaway / floor isolation, click-to-select rooms, room walkthrough

### Cinematic walkthrough
- One continuous camera path, no cuts: a full 360° orbit, arrival from the street, through the open front door, room to room through real doorways, a full turn in the main living spaces, up the stair through its stairwell, out through an upper window to the aerial view
- Drag to look around 360° at any moment (eases back to the path), scroll to change lens
- Chapter timeline: scrub, jump, play/pause, keyboard (Space, arrows, Esc); letterboxed captions with room sizes

### Look: elite residence style
- New default "Elite White" scheme: smooth satin white render, teak cladding, charcoal frames
- Projecting white frame with glass-rail balconies, timber soffits, recessed downlights, planters, vertical timber screen, stone-clad panel with wall washers
- Coconut and areca palms, leafy canopies, lush lawn, timber gate in a steel frame, residence name plate
- Night: gradient sky, stars and moon, moonlight, warm interiors, wall-wash scallops, drive bollards, lantern glows, palm uplights
- Light colour grade and vignette for a rendered-photo finish

### Studio
- Exterior and interior schemes, per-surface materials and colours, per-room finishes and wall paint
- Time-of-day slider, interior lights, furniture add / rotate / remove / re-furnish
- Undo, redo, reset, save, up to 12 restorable versions; shortcuts Ctrl+Z, Ctrl+S, R, Del, Esc

### Buyer experience
- Editorial cover with architect attribution and the site model
- Full-screen 3D explorer: rooms index with dimensions, finishes list, floor isolation, room cards, guided tour with captions

### SEO · AEO · AI crawlers
- Metadata: canonical URLs, Open Graph, Twitter card, generated OG image
- `robots.txt` allows search engines and named AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, …) on public pages and blocks private workspaces
- `sitemap.xml`, `llms.txt`, `llms-full.txt`
- JSON-LD: Organization, WebSite, SoftwareApplication, FAQPage
- Visible FAQ on `/about`; `noindex` on projects, studio, client and shared links

---

## Verified
- Production build: 15 routes, largest first load about 148 kB; Three.js lazy-loaded
- Typecheck clean
- In the browser, end to end: brief → directions → construction → 3D → studio edits, undo, save → share link → buyer cover → explorer → guided tour; sign-in guard and architect routing
- Live checks: all public routes and AI files return 200, canonical and OG point at the live domain, private pages are `noindex`, no runtime errors in Vercel logs

---

## Simulated, and labelled in the app
- **Sign-in** is a demo: no password; role and name are stored in this browser. Real accounts need an auth service such as Supabase.
- **Storage:** projects live in browser localStorage.
- **Sharing:** the buyer link carries a compressed copy of the design in the URL fragment; nothing is uploaded.
- **Plans are concepts**, not construction drawings: they need an architect's and engineer's validation.

## Not yet done
- Client sign-in path not clicked through in the browser (built and typechecked)
- P1/P2: AI-assisted generation, collaboration, cost estimation, room resizing, CAD/BIM export
- Push-to-deploy: link the GitHub repo in Vercel project settings (current deploys are from the CLI)

## Run locally
```bash
npm install
npm run dev
```
Open http://localhost:5192
