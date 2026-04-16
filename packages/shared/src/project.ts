import { z } from "zod";

export const providerSettingsSchema = z.object({
  openRouterApiKey: z.string().optional().default(""),
  replicateApiToken: z.string().optional().default("")
});

export const ringbaSettingsSchema = z.object({
  tollFreeNumber: z.string().min(1, "A Ringba number is required."),
  campaignId: z.string().optional().default(""),
  routingNotes: z.string().optional().default("")
});

export const nicheSchema = z.object({
  mainNiche: z.string().min(1, "Select a main niche."),
  mainKeywordTargets: z.array(z.string().min(1)).default([]),
  microNicheKeywords: z.array(z.string().min(1)).default([])
});

export const brandThemeSchema = z.object({
  templateFamily: z.string().min(1, "Select a template family."),
  primaryColor: z.string().min(1),
  accentColor: z.string().min(1),
  fontHeading: z.string().min(1),
  fontBody: z.string().min(1),
  imageDirection: z.string().min(1)
});

export const geoTargetSchema = z.object({
  niche: z.string().min(1),
  zip: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  county: z.string().optional().default(""),
  lat: z.number().nullable().default(null),
  lng: z.number().nullable().default(null),
  population: z.number().nullable().default(null),
  timezone: z.string().optional().default(""),
  payoutType: z.string().optional().default(""),
  payoutAmount: z.number().nullable().default(null),
  sourceSheet: z.string().optional().default(""),
  priorityScore: z.number().min(0).max(100).default(50),
  dataConfidenceScore: z.number().min(0).max(100).default(50)
});

export const promptOverridesSchema = z.object({
  homepagePrompt: z.string().optional().default(""),
  servicePrompt: z.string().optional().default(""),
  locationPrompt: z.string().optional().default(""),
  internalLinkPrompt: z.string().optional().default("")
});

export const siteProjectSchema = z.object({
  id: z.string().min(1),
  siteName: z.string().min(1, "Site name is required."),
  brandName: z.string().min(1, "Brand name is required."),
  primaryDomain: z.string().optional().default(""),
  niche: nicheSchema,
  ringba: ringbaSettingsSchema,
  brandTheme: brandThemeSchema,
  geoTargets: z.array(geoTargetSchema).default([]),
  providerSettings: providerSettingsSchema,
  promptOverrides: promptOverridesSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type ProviderSettings = z.infer<typeof providerSettingsSchema>;
export type RingbaSettings = z.infer<typeof ringbaSettingsSchema>;
export type NicheSettings = z.infer<typeof nicheSchema>;
export type BrandTheme = z.infer<typeof brandThemeSchema>;
export type GeoTarget = z.infer<typeof geoTargetSchema>;
export type PromptOverrides = z.infer<typeof promptOverridesSchema>;
export type SiteProject = z.infer<typeof siteProjectSchema>;

export const defaultProjectValues = {
  siteName: "",
  brandName: "",
  primaryDomain: "",
  niche: {
    mainNiche: "",
    mainKeywordTargets: [],
    microNicheKeywords: []
  },
  ringba: {
    tollFreeNumber: "",
    campaignId: "",
    routingNotes: ""
  },
  brandTheme: {
    templateFamily: "emergency-home-service",
    primaryColor: "#0f766e",
    accentColor: "#f97316",
    fontHeading: "Space Grotesk",
    fontBody: "Source Sans 3",
    imageDirection: "Clean, bright service photography with local trust cues"
  },
  geoTargets: [],
  providerSettings: {
    openRouterApiKey: "",
    replicateApiToken: ""
  },
  promptOverrides: {
    homepagePrompt: "",
    servicePrompt: "",
    locationPrompt: "",
    internalLinkPrompt: ""
  }
} satisfies Omit<SiteProject, "id" | "createdAt" | "updatedAt">;
