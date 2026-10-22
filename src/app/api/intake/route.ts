import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
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
});

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
- openQuestions: up to five questions the architect should ask next because the conversation left them open.`;

const fallback = (transcript: string, note: string): IntakeResult => ({ readBy: "local", extraction: sanitize(readLocally(transcript)), note });

export async function POST(req: Request) {
  let transcript = "";
  try {
    const body = (await req.json()) as { transcript?: unknown };
    transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  } catch {
    return Response.json({ error: "Send JSON with a transcript string." }, { status: 400 });
  }
  if (transcript.length < 20) return Response.json({ error: "The transcript is too short to read a brief from." }, { status: 400 });
  if (transcript.length > MAX_CHARS) return Response.json({ error: `The transcript is ${transcript.length.toLocaleString()} characters; the limit is ${MAX_CHARS.toLocaleString()}. Split it into meetings and read each one.` }, { status: 413 });

  let client: Anthropic;
  try {
    client = new Anthropic();
  } catch {
    return Response.json(fallback(transcript, "Claude is not configured on this server, so the brief was read on this device by keyword."));
  }

  try {
    const response = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium", format: zodOutputFormat(Schema) },
      system: SYSTEM,
      messages: [{ role: "user", content: `<transcript>\n${transcript}\n</transcript>` }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) return Response.json(fallback(transcript, "Claude could not read this transcript, so it was read by keyword instead."));
    const extraction = sanitize(response.parsed_output as Extraction);
    if (extraction.suggestions.length < 3) extraction.suggestions = [...extraction.suggestions, ...suggestFor(extraction, transcript)].slice(0, 3);
    return Response.json({ readBy: "claude", extraction } satisfies IntakeResult);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return Response.json(fallback(transcript, "Claude is not configured on this server, so the brief was read on this device by keyword."));
    if (error instanceof Anthropic.RateLimitError) return Response.json(fallback(transcript, "Claude is busy right now, so the brief was read by keyword. Try again in a minute for a fuller read."));
    if (error instanceof Anthropic.APIError) return Response.json(fallback(transcript, `Claude returned an error (${error.status ?? "network"}), so the brief was read by keyword.`));
    return Response.json(fallback(transcript, "Claude could not be reached, so the brief was read by keyword."));
  }
}
