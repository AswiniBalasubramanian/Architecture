// Public facts about the site, shared by metadata, structured data, robots,
// sitemap and llms.txt so every crawler hears the same thing.

export const SITE = {
  name: "ARCHFORM",
  studio: "Studio Ash & Builders",
  author: "Aswini Balasubramanian",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://studioarchitecturebyaswini.vercel.app").replace(/\/$/, ""),
  title: "ARCHFORM — AI-assisted home design studio for architects",
  description:
    "ARCHFORM turns a plot size, built-up area, rooms and budget into an editable house concept: three zoning directions, a live 2D floor plan, a textured 3D model, curated finishes and a shareable buyer walkthrough.",
  keywords: [
    "home design software",
    "architect house design tool",
    "floor plan generator",
    "3D house visualisation",
    "buyer walkthrough",
    "residential architecture concept",
    "villa design",
    "duplex house plan",
    "interior finishes configurator",
    "architectural visualisation",
  ],
  locale: "en_IN",
};

/**
 * Early feedback from practising architects, quoted word for word from what
 * they wrote (October 2026). Only their positive points are used here.
 */
export const TESTIMONIALS = [
  {
    name: "Akshita Shalini Subramani",
    initials: "AS",
    role: "Architect",
    lead: "The instant 3D outcome with multiple viewing angles and split viewing is amazing. Although basic, it provides a fast and easy temporary fix for a very time consuming process.",
    more: [
      "The variety of material and colour choices provided are useful to show the interior and exterior finishes.",
      "I like that it is a simple and interactive tool. As a layman, it gives a decent visualisation of what the house might look like.",
    ],
  },
  {
    name: "Narmada",
    initials: "N",
    role: "Senior Architect",
    lead: "Best for the earlier conversation builds. I'm going to use it for my initial client convos.",
    more: [] as string[],
  },
];

export const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "What is ARCHFORM?",
    a: "ARCHFORM is a web studio for residential architects. From a plot size, built-up area, number of floors, bedrooms, bathrooms and budget it lays out an editable home concept, lets the architect set finishes against a live 2D plan and 3D model, and publishes a read-only 3D walkthrough for the buyer.",
  },
  {
    q: "How does ARCHFORM generate a floor plan?",
    a: "A deterministic template engine fits the per-floor area inside the plot's setbacks, then arranges rooms in three zoning directions: Open Linear, Central Core and Courtyard. The stair core stays aligned on every floor. The same brief always produces the same plan.",
  },
  {
    q: "Are the generated plans ready for construction?",
    a: "No. ARCHFORM produces concepts. Setbacks, spans, room sizes and openings are planning assumptions that need validation by a qualified architect and structural engineer, and checking against local building rules, before construction.",
  },
  {
    q: "What can an architect customise?",
    a: "Exterior and interior schemes, wall, roof, floor, cabinet and upholstery materials and colours, per-room finishes and wall paint, furniture placement, time of day and interior lighting, with undo, redo, reset and saved versions.",
  },
  {
    q: "How does a client view the house?",
    a: "The architect shares a link. The client signs in as a client, opens the link and explores a read-only 3D model: floor-by-floor isolation, a room index with dimensions, the selected finishes and a guided walkthrough of every room.",
  },
  {
    q: "Which house types does ARCHFORM support?",
    a: "Villa, duplex, contemporary, traditional and compact homes, from one to three floors, with flat, gabled or hipped roofs.",
  },
  {
    q: "Where is project data stored?",
    a: "In this version projects are saved in the browser's local storage, and a buyer link carries a compressed copy of the design in its URL fragment, which browsers do not send to servers.",
  },
];

/** JSON-LD for the public pages. */
export function structuredData() {
  const org = {
    "@type": "Organization",
    "@id": `${SITE.url}/#studio`,
    name: SITE.studio,
    url: SITE.url,
    founder: { "@type": "Person", name: SITE.author },
  };
  return {
    "@context": "https://schema.org",
    "@graph": [
      org,
      {
        "@type": "WebSite",
        "@id": `${SITE.url}/#website`,
        url: SITE.url,
        name: SITE.name,
        description: SITE.description,
        publisher: { "@id": `${SITE.url}/#studio` },
        inLanguage: "en",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE.url}/#app`,
        name: SITE.name,
        applicationCategory: "DesignApplication",
        applicationSubCategory: "Architectural design and visualisation",
        operatingSystem: "Web browser",
        url: `${SITE.url}/about`,
        description: SITE.description,
        offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
        creator: { "@id": `${SITE.url}/#studio` },
        featureList: [
          "Project brief with plot, area, rooms, budget and setbacks",
          "Three generated zoning directions per brief",
          "Editable SVG floor plan with dimensions and furniture",
          "Textured, interactive 3D house model in WebGL",
          "Exterior and interior material schemes",
          "Time-of-day lighting and interior lights",
          "Undo, redo and saved versions",
          "Shareable read-only buyer walkthrough",
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE.url}/about#faq`,
        mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
      },
    ],
  };
}
