import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { RULE_ROOMS, WHERE_IDS } from "@/lib/layoutRules";
import { CURRENCY_IDS, DIRECTION_IDS, EXTERIOR_IDS, FACING_IDS, HOUSE_TYPE_IDS, INTERIOR_IDS, readLocally, REQUIREMENT_IDS, ROOF_IDS, sanitize, suggestFor, type Extraction, type IntakeResult } from "@/lib/intake";

export const maxDuration = 120;

/** Longest transcript accepted (characters). About three hours of conversation. */
const MAX_CHARS = 200_000;

const Schema = z.object({
  name: z.string().nullable(),
  location: z.string().nullable(),
  plotWidth: z.number().nullable(),
  plotDepth: z.number().nullable(),
  builtUp: z.number().nullable(),
  floors: z.number().nullable(),
  bedrooms: z.number().nullable(),
  bathrooms: z.number().nullable(),
  budget: z.number().nullable(),
  currency: z.enum(CURRENCY_IDS).nullable(),
  houseType: z.enum(HOUSE_TYPE_IDS).nullable(),
  facing: z.enum(FACING_IDS).nullable(),
  roof: z.enum(ROOF_IDS).nullable(),
  requirements: z.array(z.enum(REQUIREMENT_IDS)),
  notes: z.string(),
  evidence: z.array(z.object({ field: z.string(), quote: z.string() })),
  suggestions: z.array(
    z.object({
      title: z.string(),
      houseType: z.enum(HOUSE_TYPE_IDS),
      direction: z.enum(DIRECTION_IDS),
      exterior: z.enum(EXTERIOR_IDS),
      interior: z.enum(INTERIOR_IDS),
      why: z.string(),
    }),
  ),
  openQuestions: z.array(z.string()),
  layoutRules: z.array(
    z.object({
      room: z.enum(RULE_ROOMS),
      where: z.enum(WHERE_IDS),
      floor: z.number().nullable(),
      source: z.enum(["sketch", "conversation"]),
      quote: z.string(),
    }),
  ),
  sketchSummary: z.string().nullable(),
});

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

const SYSTEM = `You read transcripts of a first meeting between an architect and a client who wants a house built, and fill in the architect's project brief.

Rules:
- Only record what the client or architect actually said. If something was not said, return null for it (or an empty list). Never guess a number.
- Plot sizes are in feet, frontage (along the road) first as plotWidth, depth second as plotDepth. Convert metres to feet (x 3.281) and cents/grounds/guntas to feet only if the dimensions were also said. builtUp is the total built-up area in square feet across all floors.
- floors counts storeys: "G+1" is 2, "ground plus two" is 3. Maximum 3.
- budget is a plain number in the stated currency: "1.2 crore" is 12000000 INR, "80 lakhs" is 8000000 INR.
- houseType: villa, duplex, contemporary (modern, flat roof, open plan), traditional (sloped tiled roof, courtyard living, regional vernacular), compact (tight plot or tight budget).
- facing is the compass direction the plot's road frontage faces.
- requirements uses only these ids: parking (covered car parking), study (home office), pooja (prayer room), utility (laundry and utility), garden (garden-facing living), terrace (usable roof terrace), family (family lounge upstairs), vastu (Vastu or feng shui asked for).
- notes: the client's priorities and constraints that the fields don't hold (who lives there, elderly parents, accessibility, light, privacy, materials they like or dislike), written as short plain sentences for the architect.
- evidence: for each value you filled, the short exact quote it came from. field names match the keys above.
- suggestions: exactly three distinct starting points that follow what the client said about style and how they live. Use different directions where it makes sense. Exterior ids: elite-white (crisp white render, teak cladding), lime-teak (warm lime plaster, teak, clay roof), board-concrete (raw concrete, charcoal), laterite (brick and terracotta), nordic (dark timber, metal roof), white-stone (white render on a stone base). Interior ids: warm-minimal, japandi, stone-loft, classic-teak. Directions: open (stair on one side, long living-dining volume), core (stair and services at the centre), courtyard (open-to-sky court in the middle; poor on plots under 32 ft wide). why is one sentence tied to something the client said.
- openQuestions: up to five questions the architect should ask next because the conversation left them open.
- layoutRules: where rooms should go. From the conversation, record placements that were stated ("kitchen in the south-east", "stair on the left", "master bedroom at the back"); quote is the words. Compass placements use the zone ids NE, N, NW, E, C, W, SE, S, SW. Placements relative to the road use front (road side), back, left, right, middle, front-left, front-right, back-left, back-right, where left and right are as seen standing on the road looking at the house. floor is 0 for ground, 1 for first, null if not said.

When a concept sketch or schematic plan is attached:
- Read it as an architect would. Identify the road or entrance side (a road label, gate, car porch, entrance arrow or "front"; otherwise assume the bottom of the drawing is the road side). Read a north arrow if there is one.
- For each labelled or recognisable room, add a layoutRule with source "sketch" giving its position relative to the road (front/back/left/right/middle and the four corners); use compass zones only if the sketch has a north arrow and the road side is unclear. quote names what you saw ("kitchen drawn at the back right, next to dining"). Note which floor a drawing shows if it is labelled.
- Take room counts (bedrooms, bathrooms), the number of floors drawn, and any written dimensions into the fields. Never invent dimensions that are not written.
- A stair drawn in the middle suggests the core direction; an open court in the middle suggests courtyard. Let the suggestions follow the sketch.
- sketchSummary: one or two sentences describing the sketch's organisation, as you would to a colleague. null when there is no sketch.`;

const fallback = (transcript: string, note: string): IntakeResult => ({ readBy: "local", extraction: sanitize(readLocally(transcript)), note });

export async function POST(req: Request) {
  let transcript = "";
  let image: { data: string; media_type: ImageType } | null = null;
  try {
    const body = (await req.json()) as { transcript?: unknown; image?: { data?: unknown; media_type?: unknown } };
    transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
    const img = body.image;
    if (img && typeof img.data === "string" && (IMAGE_TYPES as readonly string[]).includes(String(img.media_type))) image = { data: img.data, media_type: img.media_type as ImageType };
  } catch {
    return Response.json({ error: "Send JSON with a transcript string." }, { status: 400 });
  }
  if (!image && transcript.length < 20) return Response.json({ error: "The transcript is too short to read a brief from." }, { status: 400 });
  const noClaude = image
    ? transcript.length >= 20
      ? "Reading sketches needs Claude, which isn't configured on this server (ANTHROPIC_API_KEY). Only the conversation was read, by keyword."
      : null
    : "Claude is not configured on this server, so the brief was read on this device by keyword.";
  const unavailable = (note: string) =>
    image && transcript.length < 20 ? Response.json({ error: "Reading a sketch needs Claude, which isn't configured on this server. Add ANTHROPIC_API_KEY, or add the conversation as text." }, { status: 503 }) : Response.json(fallback(transcript, image ? (noClaude ?? note) : note));
  if (transcript.length > MAX_CHARS) return Response.json({ error: `The transcript is ${transcript.length.toLocaleString()} characters; the limit is ${MAX_CHARS.toLocaleString()}. Split it into meetings and read each one.` }, { status: 413 });

  let client: Anthropic;
  try {
    client = new Anthropic();
  } catch {
    return unavailable("Claude is not configured on this server, so the brief was read on this device by keyword.");
  }

  try {
    const response = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium", format: zodOutputFormat(Schema) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            ...(image ? [{ type: "image" as const, source: { type: "base64" as const, media_type: image.media_type, data: image.data } }] : []),
            { type: "text" as const, text: transcript ? `<transcript>\n${transcript}\n</transcript>` : "There is no transcript; read the brief from the attached sketch." },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) return unavailable("Claude could not read this, so the conversation was read by keyword instead.");
    const extraction = sanitize(response.parsed_output as Extraction);
    if (extraction.suggestions.length < 3) extraction.suggestions = [...extraction.suggestions, ...suggestFor(extraction, transcript)].slice(0, 3);
    return Response.json({ readBy: "claude", extraction } satisfies IntakeResult);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return unavailable("Claude is not configured on this server, so the brief was read on this device by keyword.");
    if (error instanceof Anthropic.RateLimitError) return unavailable("Claude is busy right now, so the brief was read by keyword. Try again in a minute for a fuller read.");
    if (error instanceof Anthropic.APIError) return unavailable(`Claude returned an error (${error.status ?? "network"}), so the brief was read by keyword.`);
    return unavailable("Claude could not be reached, so the brief was read by keyword.");
  }
}
