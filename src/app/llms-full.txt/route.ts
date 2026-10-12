import { FAQ, SITE } from "@/lib/site";
import { EXTERIOR_TEMPLATES, HOUSE_TYPES, INTERIOR_TEMPLATES, DIRECTIONS, MATERIALS } from "@/lib/catalog";

export const dynamic = "force-static";

export function GET() {
  const body = `# ${SITE.name} — full reference

${SITE.description}

Studio: ${SITE.studio}. Author: ${SITE.author}. Site: ${SITE.url}

## Who it is for
- Architects: enter a brief, compare three generated design directions, customise finishes and furniture against a live 2D plan and 3D model, save versions and share a buyer preview.
- Clients and home buyers: open the shared link, sign in as a client and walk through the house in 3D.

## Brief inputs
Project name, location, plot frontage and depth (ft), built-up area (sq ft), floors (1–3), bedrooms, bathrooms, budget and currency, house type, requirements (parking, study, prayer room, utility, garden-facing living, roof terrace, family lounge) and editable assumptions (front, rear and side setbacks; floor-to-floor height).

## House types
${Object.values(HOUSE_TYPES)
  .map((t) => `- ${t.label}: ${t.blurb}.`)
  .join("\n")}

## Design directions
${Object.values(DIRECTIONS)
  .map((d) => `- ${d.label}: ${d.blurb}`)
  .join("\n")}

## Finishes
Exterior schemes: ${EXTERIOR_TEMPLATES.map((t) => `${t.label} (${t.blurb})`).join("; ")}.
Interior schemes: ${INTERIOR_TEMPLATES.map((t) => `${t.label} (${t.blurb})`).join("; ")}.
Materials: ${Object.values(MATERIALS)
    .map((m) => m.label)
    .join(", ")}.

## Visualisation
- 2D: an SVG floor plan with walls cut at openings, door swings, stairs, furniture, room names, dimensions and areas.
- Construction sequence: an isometric site model assembled by a tower crane, from setting out to roof, handing over to the 3D model.
- 3D: a WebGL model with procedural textured materials, soft shadows, ambient occlusion, time-of-day sun, interior lights, camera presets, floor isolation, cutaway and a room-by-room walkthrough.

## Limits
Plans are concepts, not construction drawings. Generation is deterministic and template-based, not an AI model. Sign-in is a demo without passwords; projects are stored in the browser.

## FAQ
${FAQ.map(({ q, a }) => `### ${q}\n${a}`).join("\n\n")}
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
