import { z } from "zod";
import type { SiteProject } from "./project";

const navLinkSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
  zip: z.string().optional()
});

const navItemSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
  dropdown: z.array(navLinkSchema).default([])
});

export const siteManifestPageSchema = z.object({
  id: z.string().min(1),
  pageType: z.enum(["homepage", "service", "state", "city", "city-service", "about", "contact"]),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  serviceKey: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  internalLinks: z.array(z.string()).default([]),
  serviceLinks: z.array(navLinkSchema).default([]),
  locationLinks: z.array(navLinkSchema).default([]),
  seoTitle: z.string().min(1),
  metaDescription: z.string().min(1),
  headingGuidance: z.string().optional(),
  seoNotes: z.string().optional(),
  pageGuidance: z.string().optional(),
  contentGuidelines: z.string().optional(),
  content: z.string().optional()
});

export const siteManifestSchema = z.object({
  projectId: z.string().min(1),
  siteName: z.string().min(1),
  brandName: z.string().min(1),
  primaryDomain: z.string().default(""),
  templateFamily: z.string().min(1),
  theme: z.object({
    primaryColor: z.string().min(1),
    accentColor: z.string().min(1),
    fontHeading: z.string().min(1),
    fontBody: z.string().min(1),
    imageDirection: z.string().min(1)
  }),
  primaryState: z.string().optional(),
  navigation: z.object({
    main: z.array(navItemSchema).default([])
  }).default({ main: [] }),
  siteGuidance: z.string().optional(),  robotsSitemapGuidance: z.string().optional(),  counts: z.object({
    totalPages: z.number().int().nonnegative(),
    servicePages: z.number().int().nonnegative(),
    statePages: z.number().int().nonnegative(),
    cityPages: z.number().int().nonnegative(),
    cityServicePages: z.number().int().nonnegative(),
    aboutPages: z.number().int().nonnegative(),
    contactPages: z.number().int().nonnegative()
  }),
  serviceKeys: z.array(z.string()).default([]),
  stateCodes: z.array(z.string()).default([]),
  pagePlan: z.array(siteManifestPageSchema).default([])
});

export type SiteManifestPage = z.infer<typeof siteManifestPageSchema>;
export type SiteManifest = z.infer<typeof siteManifestSchema>;

export function buildSiteManifest(project: SiteProject): SiteManifest {
  const serviceKeys = getServiceKeys(project);
  const stateCodes = getStateCodes(project);
  const cityTargets = getCityTargets(project);

  const primaryState = stateCodes[0] ?? project.niche.mainNiche;

  const menuServices = serviceKeys.map((service) => ({
    label: toTitle(service),
    href: `/services/${slugify(service)}`
  }));

  const menuAreas = stateCodes.map((state) => ({
    label: state,
    href: `/states/${state.toLowerCase()}`
  }));

  function buildHeadingGuidance(pageType: SiteManifestPage["pageType"], title: string) {
    const base = `Use one main H1 that closely matches the page title '${title}'. Provide focused H2 sections that help visitors and search engines understand the page structure.`;

    switch (pageType) {
      case "homepage":
        return `${base} Use H2s for the service overview, state coverage, trust signals, and the main conversion path.`;
      case "service":
        return `${base} Use H2s for service benefits, process, FAQs, and how the service connects to nearby coverage.`;
      case "state":
        return `${base} Use H2s for state coverage, city/service highlights, local relevance, and contact or next-step guidance.`;
      case "city":
        return `${base} Use H2s for local service value, nearby coverage, realistic expectations, and how to request service.`;
      case "city-service":
        return `${base} Use H2s for the service scope in that city, why the page is relevant locally, and how visitors can take action.`;
      case "about":
        return `${base} Use H2s for brand story, values, service approach, trust signals, and contact direction.`;
      case "contact":
        return `${base} Use H2s for contact options, what to share, response expectations, and next steps.`;
      default:
        return base;
    }
  }

  type PageSeed = Omit<SiteManifestPage, "seoTitle" | "metaDescription" | "headingGuidance" | "seoNotes">;

  function enrichPageSeo(page: PageSeed): SiteManifestPage {
    return {
      ...page,
      seoTitle: page.title,
      metaDescription: page.description,
      headingGuidance: buildHeadingGuidance(page.pageType, page.title),
      seoNotes: `Keep title tags under 60 characters, meta descriptions under 160 characters, and avoid keyword stuffing while using clear, local-SEO-friendly language.`
    };
  }

  const homepage: PageSeed = {
    id: "home",
    pageType: "homepage",
    slug: "/",
    title: `${project.brandName} | ${project.niche.mainNiche} Coverage`,
    description: `Nationwide ${project.niche.mainNiche.toLowerCase()} coverage with service routing, market pages, and strong local entry points.`,
    keywords: project.niche.mainKeywordTargets.slice(0, 6),
    internalLinks: [
      "/services",
      "/states",
      "/about",
      "/contact"
    ],
    serviceLinks: menuServices,
    locationLinks: menuAreas,
    pageGuidance: `Optimize this homepage for the primary state ${primaryState} while keeping the site message national. Use clear service navigation and state coverage cues.`,
    contentGuidelines: `Target 650-900 words. Include strong service overview, main state relevance, nearby coverage framing, trust signals, and CTA sections. Avoid anchor fragment links like #services or #states.`
  };

  const servicePages: PageSeed[] = serviceKeys.map((service) => ({
    id: `service:${slugify(service)}`,
    pageType: "service",
    slug: `/services/${slugify(service)}`,
    title: `${toTitle(service)} Services`,
    description: `Helpful ${service.toLowerCase()} information, service scope, FAQs, and next-step guidance.`,
    serviceKey: service,
    keywords: uniqueStrings([service, ...project.niche.mainKeywordTargets]).slice(0, 6),
    internalLinks: [
      "/",
      "/services",
      "/states",
      "/about",
      "/contact"
    ],
    serviceLinks: menuServices,
    locationLinks: menuAreas,
    pageGuidance: `Create a dedicated service page for ${service} that explains when the service is needed, the process, and common questions.`,
    contentGuidelines: `Target 550-750 words. Include specific service features, value, FAQs, and natural links to /services, /states, /about, and /contact.`
  }));

  const statePages: PageSeed[] = stateCodes.map((state) => {
    const stateZip = cityTargets.find((target) => target.state === state)?.zip;
    return {
      id: `state:${state.toLowerCase()}`,
      pageType: "state",
      slug: `/states/${state.toLowerCase()}`,
      title: `${project.niche.mainNiche} in ${state}`,
      description: `Regional ${project.niche.mainNiche.toLowerCase()} coverage, service availability, and city entry points for ${state}.`,
      state,
      zip: stateZip,
      keywords: uniqueStrings([
        `${project.niche.mainNiche} ${state}`,
        ...project.niche.mainKeywordTargets
      ]).slice(0, 5),
      internalLinks: [
        "/",
        "/services",
        "/states",
        "/about",
        "/contact"
      ],
      serviceLinks: menuServices,
      locationLinks: cityTargets
        .filter((target) => target.state === state)
        .map((target) => ({
          label: `${target.city}, ${state}`,
          href: `/locations/${slugify(state)}/${slugify(target.city)}`,
          zip: target.zip
        })),
      pageGuidance: `Build a state page that highlights regional coverage for ${state} and points users to the most important city and service pages.`,
      contentGuidelines: `Target 600-850 words. Mention the state by name, highlight city coverage, use zip-based local context where available, and include clear navigation to /services and /states.`
    };
  });

  const cityPages: PageSeed[] = cityTargets.map((target) => ({
    id: `city:${slugify(`${target.city}-${target.state}`)}`,
    pageType: "city",
    slug: `/locations/${slugify(target.state)}/${slugify(target.city)}`,
    title: `${project.niche.mainNiche} in ${target.city}, ${target.state}`,
    description: `Location-focused ${project.niche.mainNiche.toLowerCase()} guidance for ${target.city}, ${target.state}.`,
    state: target.state,
    city: target.city,
    zip: target.zip,
    keywords: uniqueStrings([
      `${project.niche.mainNiche} ${target.city}`,
      `${project.niche.mainNiche} ${target.state}`,
      ...project.niche.mainKeywordTargets
    ]).slice(0, 5),
    internalLinks: [
      "/",
      "/services",
      "/states",
      "/about",
      "/contact"
    ],
    serviceLinks: menuServices,
    locationLinks: [{
      label: `${target.city}, ${target.state}`,
      href: `/locations/${slugify(target.state)}/${slugify(target.city)}`,
      zip: target.zip
    }],
    pageGuidance: `Create a city page that reads like a real local resource for ${target.city}, ${target.state}, using zip code context when helpful.`,
    contentGuidelines: `Target 500-700 words. Include local relevance, practical service cues, and links to the main services and state pages without making fake office claims.`
  }));

  const cityServicePages: PageSeed[] = cityTargets.flatMap((target) =>
    serviceKeys.slice(0, 3).map((service) => ({
      id: `city-service:${slugify(`${target.city}-${target.state}-${service}`)}`,
      pageType: "city-service",
      slug: `/locations/${slugify(target.state)}/${slugify(target.city)}/${slugify(service)}`,
      title: `${toTitle(service)} in ${target.city}, ${target.state}`,
      description: `${toTitle(service)} information and conversion-focused local context for ${target.city}, ${target.state}.`,
      state: target.state,
      city: target.city,
      zip: target.zip,
      serviceKey: service,
      keywords: uniqueStrings([
        `${service} ${target.city}`,
        `${service} ${target.state}`,
        `${project.niche.mainNiche} ${target.city}`
      ]).slice(0, 5),
      internalLinks: [
        `/locations/${slugify(target.state)}/${slugify(target.city)}`,
        "/services",
        "/states",
        "/about",
        "/contact"
      ],
      serviceLinks: menuServices,
      locationLinks: [{
        label: `${target.city}, ${target.state}`,
        href: `/locations/${slugify(target.state)}/${slugify(target.city)}`,
        zip: target.zip
      }],
      pageGuidance: `Write a local service page for ${service} in ${target.city}, ${target.state}, with clear service details and a realistic local tone.`,
      contentGuidelines: `Target 500-650 words. Use local place context, service-specific details, and avoid generic location-only boilerplate.`
    }))
  );

  const aboutPage: PageSeed = {
    id: "about",
    pageType: "about",
    slug: "/about",
    title: `About ${project.brandName}`,
    description: `Learn about ${project.brandName}, our values, service approach, and customer care promise.`,
    keywords: uniqueStrings(["about us", project.brandName, project.niche.mainNiche]).slice(0, 6),
    internalLinks: ["/", "/services", "/states", "/contact"],
    serviceLinks: menuServices,
    locationLinks: menuAreas,
    pageGuidance: `Create an About Us page that explains the brand story, service approach, trust signals, and why customers should choose this network.`,
    contentGuidelines: `Target 450-650 words. Include clear value propositions, service focus, and a strong connection to the main niche and target states.`
  };

  const contactPage: PageSeed = {
    id: "contact",
    pageType: "contact",
    slug: "/contact",
    title: `Contact ${project.brandName}`,
    description: `Find the best ways to reach ${project.brandName} for service requests, questions, and fast local support.`,
    keywords: uniqueStrings(["contact", "customer support", project.brandName]).slice(0, 6),
    internalLinks: ["/", "/services", "/states", "/about"],
    serviceLinks: menuServices,
    locationLinks: menuAreas,
    pageGuidance: `Create a Contact page with clear instructions for how visitors should reach out, including phone, form, and service request guidance.`,
    contentGuidelines: `Target 250-400 words. Keep it practical, direct, and action-oriented.`
  };

  const pageSeeds: PageSeed[] = [
    homepage,
    ...servicePages,
    ...statePages,
    ...cityPages,
    ...cityServicePages,
    aboutPage,
    contactPage
  ];

  const pagePlan = pageSeeds.map(enrichPageSeo);

  return siteManifestSchema.parse({
    projectId: project.id,
    siteName: project.siteName,
    brandName: project.brandName,
    primaryDomain: project.primaryDomain,
    templateFamily: project.brandTheme.templateFamily,
    theme: {
      primaryColor: project.brandTheme.primaryColor,
      accentColor: project.brandTheme.accentColor,
      fontHeading: project.brandTheme.fontHeading,
      fontBody: project.brandTheme.fontBody,
      imageDirection: project.brandTheme.imageDirection
    },
    primaryState,
    navigation: {
      main: [
        { label: "Home", href: "/", dropdown: [] },
        { label: "Services", href: "/services", dropdown: menuServices },
        { label: "Areas We serve", href: "/states", dropdown: menuAreas },
        { label: "About", href: "/about", dropdown: [] },
        { label: "Contact", href: "/contact", dropdown: [] }
      ]
    },
    siteGuidance: `Use clean navigation links without hash anchors. Services should be nested under /services and areas under /states. Create About and Contact pages in the export. Provide strong state-based homepage relevance and separate service and location link groups for page rendering.`,
    seoGuidance: `Use Google-first SEO practices across the site: unique titles and meta descriptions for every page, one clear H1 per page, user-friendly H2 sections, natural local keyword usage, and no doorway or duplicate content. Prioritize local relevance and readability over aggressive exact-match optimization.`,
    robotsSitemapGuidance: `Generate robots.txt so all search engines may crawl the public site and reference the sitemap at https://${project.primaryDomain || "example.com"}/sitemap.xml. Generate sitemap.xml by listing each canonical URL from pagePlan using the primary domain, with lastmod values where available and sensible priority signals for the homepage, state pages, and city/service pages.`,
    counts: {
      totalPages: pagePlan.length,
      servicePages: servicePages.length,
      statePages: statePages.length,
      cityPages: cityPages.length,
      cityServicePages: cityServicePages.length,
      aboutPages: 1,
      contactPages: 1
    },
    serviceKeys,
    stateCodes,
    pagePlan
  });
}

function getServiceKeys(project: SiteProject) {
  const fromMicroNiches = project.niche.microNicheKeywords;
  if (fromMicroNiches.length > 0) {
    return uniqueStrings(fromMicroNiches).slice(0, 8);
  }

  if (project.niche.mainKeywordTargets.length > 0) {
    return uniqueStrings(project.niche.mainKeywordTargets).slice(0, 6);
  }

  return [project.niche.mainNiche];
}

function getStateCodes(project: SiteProject) {
  return Array.from(new Set(project.geoTargets.map((target) => target.state))).sort();
}

function getCityTargets(project: SiteProject) {
  const seen = new Set<string>();
  return project.geoTargets
    .filter((target) => {
      const key = `${target.city}|${target.state}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toTitle(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
