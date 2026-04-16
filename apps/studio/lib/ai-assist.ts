export type AssistKind = "basic" | "keywords" | "services" | "design";

export type AssistPayload = {
  kind?: AssistKind;
  niche?: string;
  siteName?: string;
  brandName?: string;
  keywordTargets?: string[];
  microNiches?: string[];
  imageDirection?: string;
  apiKey?: string;
};

export type PageContentPayload = {
  pageType: "homepage" | "service" | "state" | "city" | "city-service" | "about" | "contact";
  title: string;
  description: string;
  seoTitle: string;
  metaDescription: string;
  headingGuidance?: string;
  serviceKey?: string;
  state?: string;
  city?: string;
  zip?: string;
  primaryState?: string;
  brandName: string;
  siteName: string;
  niche: string;
  keywords: string[];
  prompt: string;
  apiKey: string;
  model: string;
};

type SuggestionResult = {
  source: "ai" | "fallback";
  data: unknown;
  note?: string;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openrouter/auto";

function normalizeOpenRouterModel(model: string) {
  if (!model) {
    return DEFAULT_MODEL;
  }

  const normalized = model.trim();

  // Accept OpenRouter model names in various formats
  if (normalized.startsWith("openrouter/") ||
      normalized.startsWith("anthropic/") ||
      normalized.startsWith("openai/") ||
      normalized.startsWith("x-ai/") ||
      normalized.startsWith("meta-llama/") ||
      normalized.startsWith("google/")) {
    return normalized;
  }

  return DEFAULT_MODEL;
}

export async function requestAiSuggestion(
  kind: AssistKind,
  payload: AssistPayload
): Promise<SuggestionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY || payload.apiKey || "";
  if (!apiKey) {
    return buildFallbackSuggestion(kind, payload);
  }

  try {
    const completion = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Nationwide Sites OS"
      },
      body: JSON.stringify({
        model: normalizeOpenRouterModel(DEFAULT_MODEL),
        temperature: 0.35,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(kind)
          },
          {
            role: "user",
            content: JSON.stringify(buildUserContext(payload))
          }
        ]
      })
    });

    if (!completion.ok) {
      throw new Error(`OpenRouter request failed with status ${completion.status}.`);
    }

    const json = (await completion.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = parseJsonContent(content);
    const data = normalizeAiPayload(kind, parsed, payload);

    return {
      source: "ai",
      data
    };
  } catch (error) {
    const fallback = buildFallbackSuggestion(kind, payload);
    return {
      ...fallback,
      note: error instanceof Error ? error.message : "Unknown AI request failure."
    };
  }
}

export function buildFallbackSuggestion(
  kind: AssistKind,
  payload: AssistPayload
): SuggestionResult {
  return {
    source: "fallback",
    data: normalizeAiPayload(kind, {}, payload)
  };
}

function buildSystemPrompt(kind: AssistKind) {
  const schemaByKind: Record<AssistKind, string> = {
    basic:
      'Return strict JSON with keys "siteName" and "brandName". Keep names short, commercially credible, and niche-appropriate.',
    keywords:
      'Return strict JSON with key "keywords" as an array of 3 to 6 keyword phrases. Focus on people-first, realistic local service search terms. Stay tightly inside the niche and do not mix in another home-service category.',
    services:
      'Return strict JSON with key "services" as an array of 4 to 8 micro-niche or service phrases that fit the niche. Stay tightly inside the niche and do not mix in another home-service category.',
    design:
      'Return strict JSON with keys "templateFamily", "primaryColor", "accentColor", and "imageDirection". The result should feel premium and distinct, not generic.'
  };

  return [
    "You are assisting a nationwide local-site generator for long-term SEO-focused leadgen websites.",
    "Prefer specific, commercially realistic outputs.",
    "Avoid spammy, thin, or over-optimized suggestions.",
    schemaByKind[kind]
  ].join(" ");
}

function buildUserContext(payload: AssistPayload) {
  return {
    niche: payload.niche ?? "",
    siteName: payload.siteName ?? "",
    brandName: payload.brandName ?? "",
    keywordTargets: payload.keywordTargets ?? [],
    microNiches: payload.microNiches ?? [],
    imageDirection: payload.imageDirection ?? ""
  };
}

function normalizeAiPayload(kind: AssistKind, parsed: Record<string, unknown>, payload: AssistPayload) {
  const niche = payload.niche ?? "";

  if (kind === "basic") {
    return {
      siteName:
        readString(parsed.siteName) || `${toDisplayNiche(niche || "Local Service")} Network`,
      brandName:
        readString(parsed.brandName) || `${toDisplayNiche(niche || "Local Service")} Connect`
    };
  }

  if (kind === "keywords") {
    const keywords = sanitizeKeywordsForNiche(readStringArray(parsed.keywords).slice(0, 6), niche);
    return {
      keywords: keywords.length > 0 ? keywords : fallbackKeywords(niche)
    };
  }

  if (kind === "services") {
    const services = sanitizeServicesForNiche(readStringArray(parsed.services).slice(0, 8), niche);
    return {
      services: services.length > 0 ? services : fallbackServices(niche)
    };
  }

  return {
    templateFamily: readString(parsed.templateFamily) || fallbackDesign(niche).templateFamily,
    primaryColor: readString(parsed.primaryColor) || fallbackDesign(niche).primaryColor,
    accentColor: readString(parsed.accentColor) || fallbackDesign(niche).accentColor,
    imageDirection:
      readString(parsed.imageDirection) || fallbackDesign(niche).imageDirection
  };
}

function fallbackDesign(niche: string) {
  const lookup = normalizeNiche(niche);
  if (/(^|\b)(plumb|plumber|plumbing)(\b|$)/.test(lookup)) {
    return {
      templateFamily: "plumbing",
      primaryColor: "#0f766e",
      accentColor: "#f97316",
      imageDirection:
        "Professional plumbing teams, clean utility spaces, water-system repairs, homeowner reassurance, and bright service-trust photography."
    };
  }
  if (lookup.includes("hvac")) {
    return {
      templateFamily: "hvac",
      primaryColor: "#1d4ed8",
      accentColor: "#f59e0b",
      imageDirection:
        "HVAC technicians in motion, equipment diagnostics, seasonal comfort scenes, and polished technical service imagery."
    };
  }
  if (lookup.includes("roof")) {
    return {
      templateFamily: "roofing",
      primaryColor: "#1f2937",
      accentColor: "#f97316",
      imageDirection:
        "Roof crews, material textures, storm-repair visuals, exterior elevation shots, and high-trust project photography."
    };
  }
  if (lookup.includes("electrical")) {
    return {
      templateFamily: "electrical",
      primaryColor: "#1d4ed8",
      accentColor: "#facc15",
      imageDirection:
        "Licensed electricians, panel work, lighting upgrades, and crisp safety-first technical imagery."
    };
  }
  if (lookup.includes("water damage")) {
    return {
      templateFamily: "water-damage",
      primaryColor: "#0f766e",
      accentColor: "#38bdf8",
      imageDirection:
        "Restoration teams, moisture mitigation scenes, cleanup process shots, and urgent recovery visuals."
    };
  }
  if (lookup.includes("mold")) {
    return {
      templateFamily: "mold",
      primaryColor: "#14532d",
      accentColor: "#84cc16",
      imageDirection:
        "Remediation crews, inspection details, containment setups, and clean indoor air quality visuals."
    };
  }
  if (lookup.includes("remodel")) {
    return {
      templateFamily: "premium-remodeling",
      primaryColor: "#1d4ed8",
      accentColor: "#f59e0b",
      imageDirection:
        "Editorial renovation photography, material detail shots, elevated interiors, craftsmanship close-ups, and polished project reveals."
    };
  }
  if (lookup.includes("appliance")) {
    return {
      templateFamily: "technical-repair",
      primaryColor: "#dc2626",
      accentColor: "#f59e0b",
      imageDirection:
        "In-home repair technicians, diagnostic close-ups, appliance restoration scenes, and clear technical trust visuals."
    };
  }
  return {
    templateFamily: "trust-heavy-leadgen",
    primaryColor: "#0f766e",
    accentColor: "#8e5dff",
    imageDirection:
      "Clear local service imagery with trust cues, branded visuals, and people-first scenes tied to the niche."
  };
}

function parseJsonContent(content: string) {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(withoutFence) as Record<string, unknown>;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : [];
}

function fallbackKeywords(niche: string) {
  const family = resolveNicheFamily(niche);
  if (family === "plumbing") {
    return ["plumber", "emergency plumber", "plumbing services"];
  }
  if (family === "roofing") {
    return ["roof repair", "roof replacement", "roofing contractor"];
  }
  if (family === "hvac") {
    return ["hvac repair", "air conditioning service", "furnace repair"];
  }
  if (family === "remodeling") {
    return ["home remodeling", "interior remodeling", "remodeling contractor"];
  }
  const display = toDisplayNiche(niche || "local service");
  return [display, `${display} services`, `${display} company`];
}

function fallbackServices(niche: string) {
  const family = resolveNicheFamily(niche);
  if (family === "plumbing") {
    return [
      "emergency plumber",
      "drain cleaning",
      "leak detection",
      "water heater repair",
      "sewer line repair",
      "toilet repair"
    ];
  }
  if (family === "roofing") {
    return [
      "roof inspection",
      "roof repair",
      "storm damage roofing",
      "roof replacement",
      "shingle repair",
      "flat roof repair"
    ];
  }
  if (family === "hvac") {
    return [
      "ac repair",
      "furnace repair",
      "heat pump service",
      "ductwork",
      "air conditioning installation",
      "indoor air quality"
    ];
  }
  if (family === "remodeling") {
    return [
      "kitchen remodeling",
      "bathroom remodeling",
      "basement finishing",
      "interior renovation",
      "home addition",
      "flooring installation"
    ];
  }
  return ["installation", "repair", "replacement", "inspection"];
}

export async function generatePageContent(payload: PageContentPayload): Promise<string> {
  const apiKey = payload.apiKey || process.env.OPENROUTER_API_KEY || "";
  if (!apiKey) {
    return buildFallbackPageContent(payload);
  }

  try {
    const completion = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Nationwide Sites OS"
      },
      body: JSON.stringify({
        model: normalizeOpenRouterModel(payload.model),
        temperature: 0.7,
        max_tokens: 2000,
        messages: [
          {
            role: "system",
            content: payload.prompt
          },
          {
            role: "user",
            content: `Write the page content using the following properties:\n- pageType: ${payload.pageType}\n- title: ${payload.title}\n- seoTitle: ${payload.seoTitle}\n- metaDescription: ${payload.metaDescription}\n- headingGuidance: ${payload.headingGuidance ?? "N/A"}\n- description: ${payload.description}\n- serviceKey: ${payload.serviceKey ?? "N/A"}\n- state: ${payload.state ?? "N/A"}\n- city: ${payload.city ?? "N/A"}\n- zip: ${payload.zip ?? "N/A"}\n- primaryState: ${payload.primaryState ?? "N/A"}\n- brandName: ${payload.brandName}\n- siteName: ${payload.siteName}\n- niche: ${payload.niche}\n- keywords: ${payload.keywords.join(", ")}`
          }
        ]
      })
    });

    if (!completion.ok) {
      const responseText = await completion.text();
      console.error("OpenRouter request failed:", completion.status, responseText);
      throw new Error(`OpenRouter request failed with status ${completion.status}. ${responseText}`);
    }

    const json = (await completion.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    return content.trim() || buildFallbackPageContent(payload);
  } catch (error) {
    console.error("Page content generation failed:", error);
    return buildFallbackPageContent(payload);
  }
}

function buildFallbackPageContent(payload: PageContentPayload): string {
  const { pageType, title, description, brandName, siteName, niche } = payload;

  if (pageType === "homepage") {
    return `# ${title}

${description}

## Why Choose ${brandName}?

${brandName} provides nationwide ${niche.toLowerCase()} coverage with professional service routing and local market expertise. Our network connects you with trusted professionals across multiple states.

## Our Services

We specialize in comprehensive ${niche.toLowerCase()} solutions including emergency repairs, routine maintenance, and specialized installations.

## Get Started Today

Contact us for reliable ${niche.toLowerCase()} services in your area.`;
  }

  if (pageType === "service") {
    return `# ${title}

${description}

## ${payload.serviceKey} Services

${brandName} offers professional ${payload.serviceKey?.toLowerCase()} services across our nationwide network. Our team provides reliable solutions for all your ${payload.serviceKey?.toLowerCase()} needs.

## What We Cover

- Emergency ${payload.serviceKey?.toLowerCase()} repairs
- Routine maintenance and inspections
- Installation and replacement services
- Expert consultation and advice

## Why Choose Our ${payload.serviceKey} Services?

With years of experience and a commitment to quality, ${brandName} delivers trustworthy ${payload.serviceKey?.toLowerCase()} solutions you can depend on.`;
  }

  if (pageType === "state") {
    return `# ${title}

${description}

## ${niche} Services in ${payload.state}

${brandName} provides comprehensive ${niche.toLowerCase()} coverage throughout ${payload.state}. Our network of professional technicians serves cities across the state with reliable, high-quality service.

## Service Areas

We serve multiple cities and communities across ${payload.state}, bringing professional ${niche.toLowerCase()} expertise to your local area.

## Local Expertise, Nationwide Support

While we operate across the country, our ${payload.state} services are backed by local knowledge and regional experience.`;
  }

  if (pageType === "city") {
    return `# ${title}

${description}

## ${niche} Services in ${payload.city}, ${payload.state}

${brandName} serves ${payload.city}, ${payload.state} with professional ${niche.toLowerCase()} services. Our local expertise combined with nationwide resources ensures you get the best possible service.

## Why Choose ${brandName} in ${payload.city}?

- Local ${payload.city} expertise
- Professional, licensed technicians
- Emergency service availability
- Comprehensive ${niche.toLowerCase()} solutions

## Serving the ${payload.city} Community

We understand the unique needs of ${payload.city} residents and businesses. Our team provides reliable, trustworthy service you can count on.`;
  }

  if (pageType === "about") {
    return `# ${title}

${description}

## Who We Are

${brandName} delivers dependable ${niche.toLowerCase()} solutions across multiple markets with a focus on professional service quality and customer trust.

## Our Approach

We combine experienced technicians, national coordination, and local market awareness to support service requests for customers in the primary state and beyond.

## Why Choose Us

- Proven service standards
- Transparent communication
- Real results from trained professionals

## Our Promise

We are committed to helping people find reliable ${niche.toLowerCase()} support without exaggerated local claims or misleading service promises.`;
  }

  if (pageType === "contact") {
    return `# ${title}

${description}

## Get in Touch

For fast service requests or questions, contact ${brandName} via phone, email, or the website contact form. Provide your location, service type, and a brief description of the issue.

## What to Share

- Your city or ZIP code
- The type of service needed
- Any urgent details or timing information

## We're Here to Help

Our team is ready to guide you through the next steps and connect you with the right service support.`;
  }

  return `# ${title}

${description}

${brandName} provides professional services in your area. Contact us today for reliable solutions.`;
}

function normalizeNiche(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function resolveNicheFamily(niche: string) {
  const lookup = normalizeNiche(niche);

  if (/(^|\b)(plumb|plumber|plumbing)(\b|$)/.test(lookup)) return "plumbing";
  if (/(^|\b)(roof|roofing|roofer)(\b|$)/.test(lookup)) return "roofing";
  if (/(^|\b)(hvac|air conditioning|ac repair|furnace|heating|cooling)(\b|$)/.test(lookup)) return "hvac";
  if (/(^|\b)(electrical|electrician|electric)(\b|$)/.test(lookup)) return "electrical";
  if (/(^|\b)(water damage|restoration|flood)(\b|$)/.test(lookup)) return "water-damage";
  if (/(^|\b)(mold|mould|remediation)(\b|$)/.test(lookup)) return "mold";
  if (/(^|\b)(remodel|remodeling|renovation|kitchen|bathroom)(\b|$)/.test(lookup)) return "remodeling";
  if (/(^|\b)(appliance)(\b|$)/.test(lookup)) return "appliance";
  return "generic";
}

function sanitizeKeywordsForNiche(keywords: string[], niche: string) {
  const family = resolveNicheFamily(niche);
  if (family === "generic") {
    return dedupePhrases(keywords.filter(Boolean));
  }

  const filtered = keywords.filter((keyword) => matchesNicheFamily(keyword, family));
  return dedupePhrases(filtered).slice(0, 6);
}

function sanitizeServicesForNiche(services: string[], niche: string) {
  const family = resolveNicheFamily(niche);
  if (family === "generic") {
    return dedupePhrases(services.filter(Boolean)).slice(0, 8);
  }

  const filtered = services.filter((service) => matchesNicheFamily(service, family));
  return dedupePhrases(filtered).slice(0, 8);
}

function matchesNicheFamily(value: string, family: string) {
  const lookup = normalizeNiche(value);

  const rules: Record<string, RegExp> = {
    plumbing: /\b(plumb|plumber|drain|leak|pipe|sewer|toilet|water heater|sump|fixture)\b/,
    roofing: /\b(roof|roofing|shingle|gutter|skylight|chimney|storm damage|flat roof)\b/,
    hvac: /\b(hvac|ac|air conditioning|cooling|furnace|heating|heat pump|thermostat|duct)\b/,
    electrical: /\b(electric|electrical|panel|wiring|lighting|generator|outlet|breaker)\b/,
    "water-damage": /\b(water damage|restoration|flood|drying|dehumid|moisture|cleanup)\b/,
    mold: /\b(mold|mould|remediation|inspection|containment|air quality)\b/,
    remodeling: /\b(remodel|renovation|kitchen|bathroom|basement|flooring|addition|interior)\b/,
    appliance: /\b(appliance|refrigerator|washer|dryer|dishwasher|oven|stove|freezer)\b/
  };

  return rules[family]?.test(lookup) ?? true;
}

function dedupePhrases(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    const key = normalizeNiche(trimmed);
    if (!trimmed || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function toDisplayNiche(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

