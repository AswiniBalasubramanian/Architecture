import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { EXTERIOR_TEMPLATES, FURNITURE, INTERIOR_TEMPLATES } from "@/lib/catalog";
import { OP_NAMES } from "@/lib/commands";
import { WHERE_IDS } from "@/lib/layoutRules";

export const maxDuration = 60;

const Schema = z.object({
  reply: z.string(),
  ops: z.array(
    z.object({
      op: z.enum(OP_NAMES),
      room: z.string().nullable(),
      room2: z.string().nullable(),
      value: z.string().nullable(),
      number: z.number().nullable(),
      side: z.string().nullable(),
      color: z.string().nullable(),
      flag: z.boolean().nullable(),
    }),
  ),
});

const SYSTEM = `You are the command bar of ARCHFORM, a concept-design studio for houses. An architect types a request; you turn it into operations on the current design, and a one-sentence reply.

Every operation has the fields op, room, room2, value, number, side, color, flag; set the ones the op uses and null the rest. Rooms are referenced by the id from the context.

Operations:
- roof: value flat | gable | hip.
- exterior_scheme: value one of ${EXTERIOR_TEMPLATES.map((t) => `${t.id} (${t.label}: ${t.blurb})`).join("; ")}.
- interior_scheme: value one of ${INTERIOR_TEMPLATES.map((t) => `${t.id} (${t.label})`).join("; ")}.
- material: side is the surface (exterior, accent, roof, frames, floor, walls, cabinets, furniture); value a material (plaster, brick, stone, concrete, wood, tile, terracotta, metal, marble, lacquer, fabric, glass) or null; color a #rrggbb hex or null.
- lighting: number is the hour 6-20 (19.5 for night) or null; flag true/false switches interior lights, or null.
- rename_room: room, value the new name.
- room_use: room, value a room type (living, dining, kitchen, bedroom, master, bath, study, family, utility, pooja). Not the stair.
- swap_rooms: room and room2 on the same floor trade places.
- room_finish: room, value a floor material, color hex or null.
- wall_color: room, color hex.
- add_furniture: room, value a kind (${Object.keys(FURNITURE).join(", ")}), number how many (default 1).
- remove_furniture: room or null for anywhere, value a kind or null for all kinds, flag true to remove every match, number how many otherwise.
- refurnish: room gets the default furniture again.
- window: room, side front|back|left|right or null for all its outside walls, number feet; flag true means number is a change (+2 wider), false means the new width; number 0 removes the window.
- door: room and room2, value door | open | none (none is a solid wall).
- resize_room: room, number feet (positive grows, negative shrinks), side front|back|left|right or null to pick any wall that can move.
- set_brief: value is the field. For bedrooms, bathrooms, floors (1-3), plotWidth, plotDepth, builtUp put the new number in number. For houseType (villa, duplex, contemporary, traditional, compact) or facing (north, east, south, west) put the choice in color. Changes regenerate the layout; finishes are kept.
- add_requirement / remove_requirement: value parking | study | pooja | utility | garden | terrace | family | vastu. Regenerates.
- direction: value open | core | courtyard. Regenerates.
- add_rule: room a room type (living, dining, kitchen, master, bedroom, bath, stair, foyer, parking, study, family, utility, pooja, court); value a position (${WHERE_IDS.join(", ")}; compass zones or road-relative positions, left/right as seen from the road); number the floor (0 ground) or null. Regenerates and the layout follows the rule where it can.
- clear_rules.
- view: value plan | 3d | split or null; flag true for cutaway, false for the whole house with its roof, or null.
- undo, redo, save (value an optional version label).

Rules:
- Do exactly what was asked, in as few operations as it needs. Several requests in one message become several operations.
- If the request is ambiguous or can't be done with these operations, return no operations and ask one short question, or say what isn't possible.
- "this room" or "it" means the selected room in the context.
- reply: one short plain sentence saying what you changed, or the question. No emoji.`;

export async function POST(req: Request) {
  let text = "";
  let context: unknown = null;
  try {
    const body = (await req.json()) as { text?: unknown; context?: unknown };
    text = typeof body.text === "string" ? body.text.trim() : "";
    context = body.context;
  } catch {
    return Response.json({ error: "Send JSON with text and context." }, { status: 400 });
  }
  if (!text) return Response.json({ error: "Type a request." }, { status: 400 });
  if (text.length > 2000) return Response.json({ error: "That request is too long; keep it under 2,000 characters." }, { status: 413 });
  // Without credentials, say so at once; the studio then reads the request by keyword.
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return Response.json({ fallback: true, reason: "not-configured" });

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(Schema) },
      system: SYSTEM,
      messages: [{ role: "user", content: `<design>\n${JSON.stringify(context)}\n</design>\n\n<request>\n${text}\n</request>` }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) return Response.json({ fallback: true, reason: "unreadable" });
    return Response.json({ readBy: "claude", ...response.parsed_output });
  } catch (error) {
    const reason = error instanceof Anthropic.RateLimitError ? "busy" : error instanceof Anthropic.AuthenticationError ? "not-configured" : "error";
    return Response.json({ fallback: true, reason });
  }
}
