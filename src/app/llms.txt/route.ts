import { FAQ, SITE } from "@/lib/site";

export const dynamic = "force-static";

// https://llmstxt.org — a plain summary for AI agents and answer engines.
export function GET() {
  const body = `# ${SITE.name}

> ${SITE.description}

Built by ${SITE.studio} (${SITE.author}).

## Pages
- [About ARCHFORM](${SITE.url}/about): what the studio does, the workflow, finishes, buyer previews and an FAQ.
- [Sign in](${SITE.url}/login): choose Architect (create and edit projects) or Client (open a shared house).
- [Full text for AI agents](${SITE.url}/llms-full.txt): every public fact on one page.

## Workflow
Configure → Generate → Customise → Visualise → Share → Explore.

## Key facts
${FAQ.map(({ q, a }) => `- ${q} ${a}`).join("\n")}
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
