import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// Public pages are open to search engines and to AI crawlers by name; private
// workspaces (projects, studio, shared design links) stay out of every index.
const PRIVATE = ["/projects", "/new", "/p/", "/client", "/view"];
const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "anthropic-ai", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot", "Bytespider", "Amazonbot", "meta-externalagent", "cohere-ai", "DuckAssistBot", "YouBot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/about", "/login", "/llms.txt", "/llms-full.txt"], disallow: PRIVATE },
      { userAgent: AI_BOTS, allow: ["/", "/about", "/login", "/llms.txt", "/llms-full.txt"], disallow: PRIVATE },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
