import {
  buildSiteManifest,
  defaultProjectValues,
  geoTargetSchema,
  siteProjectSchema,
  type SiteProject
} from "@nls/shared";
import { generatePageContent, type PageContentPayload } from "./ai-assist";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@libsql/client";
import { importGeoTargetsForNiche } from "./workbook-import";

let dbInstance: any = null;
let dbInitializationError: Error | null = null;
let libsqlClient: ReturnType<typeof createClient> | null = null;

function getLibsql() {
  if (libsqlClient) return libsqlClient;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url) {
    libsqlClient = createClient({ url, authToken });
    return libsqlClient;
  }
  return null;
}

async function getDb(): Promise<any> {
  if (dbInstance) return dbInstance;
  if (dbInitializationError && !process.env.NETLIFY) throw dbInitializationError;

  const defaultDatabasePath = resolve(process.cwd(), "data", "studio.db");
  const configuredPath = process.env.DATABASE_URL?.startsWith("file:")
    ? process.env.DATABASE_URL.slice(5)
    : process.env.DATABASE_URL;
  
  let databasePath = configuredPath
    ? resolve(process.cwd(), configuredPath)
    : defaultDatabasePath;

  const isNetlify = Boolean(process.env.NETLIFY || process.env.NEXT_RUNTIME === "edge");
  
  try {
    if (!isNetlify) {
      mkdirSync(dirname(databasePath), { recursive: true });
    } else if (!configuredPath) {
      databasePath = ":memory:";
    }

    try {
        const { DatabaseSync } = await import("node:sqlite") as any;
        dbInstance = new DatabaseSync(databasePath);
        initializeSchema(dbInstance);
        return dbInstance;
    } catch (e) {
        console.warn("node:sqlite not available, using in-memory fallback if possible");
        // Create a dummy object if needed, or row forward to Turso
        throw new Error("Local database unavailable. Please configure TURSO_DATABASE_URL for cloud storage.");
    }
  } catch (error) {
    dbInitializationError = error instanceof Error ? error : new Error(String(error));
    console.error("Database initialization failed:", dbInitializationError);
    
    try {
      const { DatabaseSync } = await import("node:sqlite") as any;
      dbInstance = new DatabaseSync(":memory:");
      initializeSchema(dbInstance);
      return dbInstance;
    } catch (innerError) {
      throw dbInitializationError;
    }
  }
}

let isRemoteInitialized = false;
async function ensureRemoteSchema() {
  if (isRemoteInitialized) return;
  const client = getLibsql();
  if (!client) return;

  try {
    await client.batch([
      `CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        site_name TEXT NOT NULL,
        brand_name TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS studio_settings (
        id TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS prompt_library (
        id TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS geo_targets (
          id TEXT PRIMARY KEY,
          niche TEXT NOT NULL,
          state TEXT NOT NULL,
          city TEXT NOT NULL,
          zip TEXT NOT NULL,
          payout TEXT,
          duration TEXT,
          payout_raw REAL,
          duration_raw REAL
      )`
    ], "write");
    isRemoteInitialized = true;
  } catch (error) {
    console.error("Remote schema initialization failed (lazy retry will occur):", error);
  }
}

function initializeSchema(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      site_name TEXT NOT NULL,
      brand_name TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS studio_settings (
      id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_library (
      id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

const exportsDirectory = resolve(process.cwd(), "..", "exports");
if (!process.env.NETLIFY) {
  try {
    mkdirSync(exportsDirectory, { recursive: true });
  } catch (e) {
    // Ignore error if we can't create exports dir (common in CI/Netlify)
  }
}

type ProjectListItem = Pick<
  SiteProject,
  "id" | "siteName" | "brandName" | "createdAt" | "updatedAt"
> & {
  primaryDomain: string;
  mainNiche: string;
  geoTargetCount: number;
  stateCount: number;
  keywordCount: number;
  microNicheCount: number;
  hasProviders: boolean;
  healthStatus: "ready" | "needs-attention";
  sampleLocations: string[];
};

export type ExportListItem = {
  fileName: string;
  projectId: string;
  siteName: string;
  exportedAt: string;
  filePath: string;
  sizeBytes: number;
  totalPages: number;
  templateFamily: string;
};

export type StudioSettings = {
  openRouterApiKey: string;
  replicateApiToken: string;
  defaultTextModel: string;
  defaultImageModel: string;
  workspaceNotes: string;
  updatedAt: string;
};

export type PromptLibrary = {
  homepagePrompt: string;
  servicePrompt: string;
  locationPrompt: string;
  aboutPrompt: string;
  contactPrompt: string;
  internalLinkPrompt: string;
  updatedAt: string;
};

const defaultStudioSettings: Omit<StudioSettings, "updatedAt"> = {
  openRouterApiKey: "",
  replicateApiToken: "",
  defaultTextModel: "anthropic/claude-sonnet-4",
  defaultImageModel: "minimax/image-01",
  workspaceNotes: "Store admin-wide provider keys and default model choices here."
};

const defaultPromptLibrary: Omit<PromptLibrary, "updatedAt"> = {
  homepagePrompt: `You are writing the homepage for a nationwide local-service lead generation site.

Primary objective:
- Create people-first, useful, trustworthy content that helps a real visitor understand the service, service scope, trust signals, and next step.

Google-aligned content rules:
- Do not create thin, vague, filler-heavy, or generic AI-sounding copy.
- Do not write doorway-style content or pages built only to rank for many cities.
- Every section must add distinct value for the visitor.
- Make claims only when they can be supported by provided inputs.
- Keep the writing clear, direct, and conversion-focused without sounding spammy.
- Match visible content to any structured-data intent and business framing.

Homepage requirements:
- Clearly explain the main niche, who the site helps, and the types of services offered.
- Include a strong brand/trust introduction, a useful services overview, FAQs, and natural CTA language.
- Show why the site is relevant across multiple markets without pretending there is a physical office in every city.
- Use a helpful heading structure and avoid repetitive keyword stuffing.
- Add meaningful reasons-to-choose-us content, but keep it realistic and specific.

Writing style:
- Human, clear, helpful, confident.
- Use natural phrasing, partial-match phrasing, and semantic variation.
- Avoid exaggerated marketing hype and avoid repeating the same keyword patterns.`,
  servicePrompt: `You are writing a service page for a nationwide local-service website.

Primary objective:
- Build a strong, useful page around one service intent so the page genuinely helps users understand the service, use cases, process, FAQs, and next step.

Google-aligned content rules:
- No thin content.
- No boilerplate sections that could fit any service without change.
- No keyword stuffing or over-optimized repeated phrases.
- Every service page must have a unique purpose and meaningful details.
- Make the copy useful enough that a real visitor could rely on it before calling.

Service-page requirements:
- Focus on one clear service intent.
- Explain what the service is, when someone may need it, common problems, expected process, and important considerations.
- Add service-specific FAQs and conversion guidance.
- Differentiate this service from adjacent micro-niches where relevant.
- Use practical, experience-shaped language instead of generic promotional fluff.

SEO and quality rules:
- Use the main service keyword naturally in major headings and early body copy, but prioritize readability.
- Include semantic variants and related terms instead of exact-match repetition.
- Ensure the page can stand alone as useful content even without other pages.`,
  locationPrompt: `You are writing a location page for a nationwide local-service website.

Primary objective:
- Create a location page that is actually useful for visitors in that market and not a doorway page with swapped city names.

Google-aligned content rules:
- Do not mass-produce generic location copy.
- Do not imply a false local office presence.
- Do not reuse the same structure and wording with only the city replaced.
- Every location page must include local relevance, practical service framing, and a clear user purpose.

Location-page requirements:
- Reference the city/state naturally and only where relevant.
- Include local service context, realistic service considerations, market-relevant FAQs, and useful next-step information.
- Mention nearby coverage, service availability framing, or regional realities only if supported by input data.
- Keep the page clearly differentiated from other city pages.
- Add internal links only when they help users find adjacent services or broader regional pages.

Quality thresholds:
- The page must feel written for a person in that location.
- It must include enough unique detail that it can stand on its own.
- If unique local value is weak, the content should be more conservative and avoid fake specificity.`,
  aboutPrompt: `You are writing the About Us page for a nationwide local-service website.

Primary objective:
- Introduce the brand, explain the service approach, and build trust with visitors.

About-page requirements:
- Share the company mission, values, and professional service standards.
- Explain how the brand supports local markets without pretending to operate a local branch in every location.
- Mention the main niche and primary state focus in a natural way.
- Include reasons to choose the brand and what makes this service network reliable.
- Keep navigation signals clear toward /services, /states, and /contact.

Writing style:
- Honest, friendly, trustworthy, and professional.
- Avoid generic corporate fluff and instead focus on real customer value.`,
  contactPrompt: `You are writing the Contact page for a nationwide local-service website.

Primary objective:
- Give visitors clear, direct instructions for how to reach out and request service.

Contact-page requirements:
- Include phone, form, email, or help request guidance.
- Explain when to use the contact page and what information to provide.
- Mention service support for the main niche and primary state market if relevant.
- Keep the user path simple and conversion-focused.

Writing style:
- Direct, helpful, and easy to scan.
- Avoid unnecessary detail and keep the page action-oriented.`,
  internalLinkPrompt: `You are planning internal links for a nationwide local-service website.

Primary objective:
- Create helpful internal links that improve navigation, topical understanding, and page discovery without looking manipulative.

Google-aligned link rules:
- Internal links must help users, not just rankings.
- Avoid exact-match anchor overuse.
- Do not force links into unrelated contexts.
- Use a mix of branded, natural-language, partial-match, and descriptive anchors.
- Keep the link graph logical: homepage -> services/states, states -> cities, cities -> relevant services, services -> strongest supporting locations.
- Keep services and areas as separate link groups; avoid combining city and service URLs into one block.

Output requirements:
- Suggest related links based on real topical and geographic relationships.
- Provide varied anchor text that sounds natural in a sentence.
- Prefer clarity over keyword density.
- Avoid linking every page to every other page.
- Keep the structure crawlable, useful, and easy for visitors to follow.`
};

export async function listProjects(): Promise<ProjectListItem[]> {
  await ensureRemoteSchema();
  const libsql = getLibsql();

  let rows: any[] = [];

  if (libsql) {
    try {
      const rs = await libsql.execute(`
        SELECT id, site_name, brand_name, payload_json, created_at, updated_at
        FROM projects
        ORDER BY datetime(updated_at) DESC
      `);
      rows = rs.rows;
    } catch (error) {
       console.error("Turso project list error:", error);
       rows = [];
    }
  } else {
    rows = (await getDb())
      .prepare(
        `
          SELECT id, site_name, brand_name, payload_json, created_at, updated_at
          FROM projects
          ORDER BY datetime(updated_at) DESC
        `
      )
      .all();
  }

  return rows.map((row) => buildProjectListItem({
    id: row.id,
    site_name: row.site_name as string,
    brand_name: row.brand_name as string,
    payload_json: row.payload_json as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string
  }));
}

export function listExports(): ExportListItem[] {
  if (!existsSync(exportsDirectory)) {
    return [];
  }

  return readdirSync(exportsDirectory)
    .filter((entry) => entry.endsWith(".json") || entry.endsWith(".zip"))
    .map((entry) => {
      const filePath = resolve(exportsDirectory, entry);
      const isZip = entry.endsWith(".zip");
      const jsonFile = isZip ? entry.replace(".zip", ".json") : entry;
      const jsonPath = resolve(exportsDirectory, jsonFile);

      let payload: any = {};
      if (existsSync(jsonPath)) {
        payload = JSON.parse(readFileSync(jsonPath, "utf8")) as {
          projectId: string;
          siteName: string;
          exportedAt: string;
          siteManifest?: {
            counts?: { totalPages?: number };
            templateFamily?: string;
          };
        };
      }

      const stats = statSync(filePath);
      return {
        fileName: entry,
        projectId: payload.projectId || "unknown",
        siteName: payload.siteName || "Unknown Site",
        exportedAt: payload.exportedAt || new Date(stats.mtime).toISOString(),
        filePath,
        sizeBytes: stats.size,
        totalPages: payload.siteManifest?.counts?.totalPages ?? 0,
        templateFamily: payload.siteManifest?.templateFamily ?? "unknown"
      };
    })
    .sort((left, right) => right.exportedAt.localeCompare(left.exportedAt));
}

export async function getProjectById(id: string): Promise<SiteProject | null> {
  await ensureRemoteSchema();
  const libsql = getLibsql();

  let payloadJson: string | null = null;

  if (libsql) {
    const rs = await libsql.execute({
      sql: "SELECT payload_json FROM projects WHERE id = ?",
      args: [id]
    });
    if (rs.rows.length > 0) {
      payloadJson = rs.rows[0].payload_json as string;
    }
  } else {
    const row = (await getDb())
      .prepare(
        `
          SELECT payload_json
          FROM projects
          WHERE id = ?
        `
      )
      .get(id) as { payload_json: string } | undefined;
    
    if (row) {
      payloadJson = row.payload_json;
    }
  }

  if (!payloadJson) {
    return null;
  }

  return siteProjectSchema.parse(JSON.parse(payloadJson));
}

export function createProjectDraft() {
  return structuredClone(defaultProjectValues);
}

export async function saveProject(input: Record<string, string>): Promise<SiteProject> {
  const now = new Date().toISOString();
  const project = siteProjectSchema.parse({
    id: crypto.randomUUID(),
    ...buildProjectPayload(input, now, now)
  });

  const libsql = getLibsql();
  if (libsql) {
    try {
      await libsql.execute({
        sql: `
          INSERT INTO projects (id, site_name, brand_name, payload_json, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [
          project.id,
          project.siteName,
          project.brandName,
          JSON.stringify(project),
          project.createdAt,
          project.updatedAt
        ]
      });
    } catch (error) {
       await handleWriteErrorAsync(error, "Project");
    }
  } else {
    try {
      (await getDb()).prepare(
        `
          INSERT INTO projects (
            id,
            site_name,
            brand_name,
            payload_json,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `
      ).run(
        project.id,
        project.siteName,
        project.brandName,
        JSON.stringify(project),
        project.createdAt,
        project.updatedAt
      );
    } catch (error) {
      handleWriteError(error);
    }
  }


  return project;
}

export async function updateProject(id: string, input: Record<string, string>): Promise<SiteProject> {
  const existing = await getProjectById(id);
  if (!existing) {
    throw new Error("Project not found.");
  }

  const updatedAt = new Date().toISOString();
  const project = siteProjectSchema.parse({
    id,
    ...buildProjectPayload(input, existing.createdAt, updatedAt)
  });

  const libsql = getLibsql();
  if (libsql) {
    try {
      await libsql.execute({
        sql: `
          UPDATE projects
          SET site_name = ?, brand_name = ?, payload_json = ?, updated_at = ?
          WHERE id = ?
        `,
        args: [project.siteName, project.brandName, JSON.stringify(project), project.updatedAt, project.id]
      });
    } catch (error) {
      await handleWriteErrorAsync(error, "Project");
    }
  } else {
    try {
      (await getDb()).prepare(
        `
          UPDATE projects
          SET site_name = ?, brand_name = ?, payload_json = ?, updated_at = ?
          WHERE id = ?
        `
      ).run(project.siteName, project.brandName, JSON.stringify(project), project.updatedAt, project.id);
    } catch (error) {
      handleWriteError(error);
    }
  }


  return project;
}

export async function exportProjectBundle(projectId: string) {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  const exportedAt = new Date().toISOString();
  const fileName = `${slugify(project.siteName)}-${exportedAt.replace(/[:.]/g, "-")}.json`;
  const filePath = resolve(exportsDirectory, fileName);
  const siteManifest = buildSiteManifest(project);

  // Get settings and prompts for AI generation
  const settings = await getStudioSettings();
  const prompts = await getPromptLibrary();

  // Generate content for each page
  const pagesWithContent = await Promise.all(
    siteManifest.pagePlan.map(async (page) => {
      const prompt = getPromptForPageType(page.pageType, prompts);

      const contentPayload: PageContentPayload = {
        pageType: page.pageType,
        title: page.title,
        seoTitle: page.seoTitle,
        metaDescription: page.metaDescription,
        headingGuidance: page.headingGuidance,
        description: page.description,
        serviceKey: page.serviceKey,
        state: page.state,
        city: page.city,
        zip: page.zip,
        primaryState: siteManifest.primaryState,
        brandName: siteManifest.brandName,
        siteName: siteManifest.siteName,
        niche: project.niche.mainNiche,
        keywords: page.keywords,
        prompt,
        apiKey: settings.openRouterApiKey,
        model: settings.defaultTextModel
      };

      const content = await generatePageContent(contentPayload);
      return { ...page, content };
    })
  );

  const manifestWithContent = { ...siteManifest, pagePlan: pagesWithContent };

  const payload = {
    projectId: project.id,
    siteName: project.siteName,
    exportedAt,
    exportType: "astro-site-manifest",
    siteManifest: manifestWithContent,
    project
  };

  writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");

  return {
    fileName,
    filePath,
    zipFilePath: null,
    exportedAt
  };
}

export async function getStudioSettings(): Promise<StudioSettings> {
  await ensureRemoteSchema();
  const libsql = getLibsql();

  let dbPayload: Partial<StudioSettings> = {};
  let updatedAt = "";

  if (libsql) {
    try {
      const rs = await libsql.execute({
        sql: "SELECT payload_json, updated_at FROM studio_settings WHERE id = ?",
        args: ["default"]
      });
      if (rs.rows.length > 0) {
        dbPayload = JSON.parse(rs.rows[0].payload_json as string);
        updatedAt = rs.rows[0].updated_at as string;
      }
    } catch (error) {
      console.error("Failed to read studio settings from Turso:", error);
    }
  } else {
    try {
      const row = (await getDb())
        .prepare(
          `
            SELECT payload_json, updated_at
            FROM studio_settings
            WHERE id = ?
          `
        )
        .get("default") as { payload_json: string; updated_at: string } | undefined;

      if (row) {
        dbPayload = JSON.parse(row.payload_json);
        updatedAt = row.updated_at;
      }
    } catch (error) {
      console.error("Failed to read studio settings from database:", error);
    }
  }

  return {
    ...defaultStudioSettings,
    ...dbPayload,
    // Prioritize ENV vars if available, otherwise use DB or default
    openRouterApiKey: process.env.OPENROUTER_API_KEY || dbPayload.openRouterApiKey || defaultStudioSettings.openRouterApiKey,
    replicateApiToken: process.env.REPLICATE_API_TOKEN || dbPayload.replicateApiToken || defaultStudioSettings.replicateApiToken,
    updatedAt
  };
}

export async function saveStudioSettings(input: Record<string, string>): Promise<StudioSettings> {
  const updatedAt = new Date().toISOString();
  const settings: StudioSettings = {
    openRouterApiKey: input.openRouterApiKey.trim(),
    replicateApiToken: input.replicateApiToken.trim(),
    defaultTextModel: input.defaultTextModel.trim() || defaultStudioSettings.defaultTextModel,
    defaultImageModel: input.defaultImageModel.trim() || defaultStudioSettings.defaultImageModel,
    workspaceNotes: input.workspaceNotes.trim() || defaultStudioSettings.workspaceNotes,
    updatedAt
  };

  const libsql = getLibsql();
  if (libsql) {
    try {
      await libsql.execute({
        sql: `
          INSERT INTO studio_settings (id, payload_json, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            payload_json = excluded.payload_json,
            updated_at = excluded.updated_at
        `,
        args: ["default", JSON.stringify(settings), updatedAt]
      });
    } catch (error) {
      await handleWriteErrorAsync(error, "Studio AI settings");
    }
  } else {
    try {
      (await getDb()).prepare(
        `
          INSERT INTO studio_settings (id, payload_json, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            payload_json = excluded.payload_json,
            updated_at = excluded.updated_at
        `
      ).run("default", JSON.stringify(settings), updatedAt);
    } catch (error) {
      handleWriteError(error, "Studio AI settings");
    }
  }

  return settings;
}

async function handleWriteErrorAsync(error: unknown, context: string = "Data") {
  console.error(`Failed to save ${context} to Turso:`, error);
  throw error;
}

function handleWriteError(error: unknown, context: string = "Data") {
  console.error(`Failed to save ${context} to database:`, error);
  if (
    error instanceof Error &&
    (error.message.includes("readonly") ||
      error.message.includes("EPERM") ||
      error.message.includes("EROFS") ||
      error.message.includes("database is locked"))
  ) {
    throw new Error(
      `The studio is running in a read-only environment (like Netlify). ${context} cannot be saved to the local database. If you are setting API keys, please use Environment Variables in your Netlify Dashboard instead.`
    );
  }
  throw error;
}

export async function getPromptLibrary(): Promise<PromptLibrary> {
  await ensureRemoteSchema();
  const libsql = getLibsql();

  let dbPayload: Partial<PromptLibrary> = {};
  let updatedAt = "";

  if (libsql) {
    try {
      const rs = await libsql.execute({
        sql: "SELECT payload_json, updated_at FROM prompt_library WHERE id = ?",
        args: ["default"]
      });
      if (rs.rows.length > 0) {
        dbPayload = JSON.parse(rs.rows[0].payload_json as string);
        updatedAt = rs.rows[0].updated_at as string;
      }
    } catch (error) {
      console.error("Failed to read prompt library from Turso:", error);
    }
  } else {
    const row = (await getDb())
      .prepare(
        `
          SELECT payload_json, updated_at
          FROM prompt_library
          WHERE id = ?
        `
      )
      .get("default") as { payload_json: string; updated_at: string } | undefined;

    if (row) {
      dbPayload = JSON.parse(row.payload_json);
      updatedAt = row.updated_at;
    }
  }

  return {
    ...defaultPromptLibrary,
    ...dbPayload,
    updatedAt
  };
}

export async function savePromptLibrary(input: Record<string, string>): Promise<PromptLibrary> {
  const updatedAt = new Date().toISOString();
  const prompts: PromptLibrary = {
    homepagePrompt: input.homepagePrompt.trim() || defaultPromptLibrary.homepagePrompt,
    servicePrompt: input.servicePrompt.trim() || defaultPromptLibrary.servicePrompt,
    locationPrompt: input.locationPrompt.trim() || defaultPromptLibrary.locationPrompt,
    aboutPrompt: input.aboutPrompt.trim() || defaultPromptLibrary.aboutPrompt,
    contactPrompt: input.contactPrompt.trim() || defaultPromptLibrary.contactPrompt,
    internalLinkPrompt: input.internalLinkPrompt.trim() || defaultPromptLibrary.internalLinkPrompt,
    updatedAt
  };

  const libsql = getLibsql();
  if (libsql) {
    try {
      await libsql.execute({
        sql: `
          INSERT INTO prompt_library (id, payload_json, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            payload_json = excluded.payload_json,
            updated_at = excluded.updated_at
        `,
        args: ["default", JSON.stringify(prompts), updatedAt]
      });
    } catch (error) {
      await handleWriteErrorAsync(error, "Prompt library");
    }
  } else {
    try {
      (await getDb()).prepare(
        `
          INSERT INTO prompt_library (id, payload_json, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            payload_json = excluded.payload_json,
            updated_at = excluded.updated_at
        `
      ).run("default", JSON.stringify(prompts), updatedAt);
    } catch (error) {
      handleWriteError(error, "Prompt library");
    }
  }

  return prompts;
}

function buildProjectPayload(input: Record<string, string>, createdAt: string, updatedAt: string) {
  const selectedStates = parseCommaList(input.selectedStates);
  // For final save, import ALL targets for the niche (not limited by geoImportLimit)
  // geoImportLimit is only used for preview in the UI table
  const geoTargets = shouldImportGeoTargets(input)
    ? filterGeoTargetsByStates(
        importGeoTargetsForNiche(input.mainNiche, 50000), // Use very high limit to get all targets
        selectedStates
      )
    : [];

  return {
    siteName: input.siteName,
    brandName: input.brandName,
    primaryDomain: input.primaryDomain,
    niche: {
      mainNiche: input.mainNiche,
      mainKeywordTargets: parseCommaList(input.mainKeywordTargets),
      microNicheKeywords: parseCommaList(input.microNicheKeywords)
    },
    ringba: {
      tollFreeNumber: input.tollFreeNumber,
      campaignId: input.campaignId,
      routingNotes: input.routingNotes
    },
    brandTheme: {
      templateFamily: input.templateFamily,
      primaryColor: input.primaryColor,
      accentColor: input.accentColor,
      fontHeading: input.fontHeading,
      fontBody: input.fontBody,
      imageDirection: input.imageDirection
    },
    geoTargets,
    providerSettings: {
      openRouterApiKey: input.openRouterApiKey,
      replicateApiToken: input.replicateApiToken
    },
    promptOverrides: {
      homepagePrompt: input.projectHomepagePrompt,
      servicePrompt: input.projectServicePrompt,
      locationPrompt: input.projectLocationPrompt,
      internalLinkPrompt: input.projectInternalLinkPrompt
    },
    createdAt,
    updatedAt
  };
}

function buildProjectListItem(row: {
  id: string;
  site_name: string;
  brand_name: string;
  payload_json: string;
  created_at: string;
  updated_at: string;
}) {
  const payload = JSON.parse(row.payload_json) as SiteProject;
  const keywordCount = payload.niche.mainKeywordTargets.length;
  const microNicheCount = payload.niche.microNicheKeywords.length;
  const hasProviders = Boolean(
    payload.providerSettings.openRouterApiKey || payload.providerSettings.replicateApiToken
  );
  const healthStatus: ProjectListItem["healthStatus"] = payload.primaryDomain && payload.geoTargets.length > 0 && keywordCount > 0
    ? "ready"
    : "needs-attention";

  return {
    id: row.id,
    siteName: row.site_name,
    brandName: row.brand_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    primaryDomain: payload.primaryDomain,
    mainNiche: payload.niche.mainNiche,
    geoTargetCount: payload.geoTargets.length,
    stateCount: new Set(payload.geoTargets.map((target) => target.state)).size,
    keywordCount,
    microNicheCount,
    hasProviders,
    healthStatus,
    sampleLocations: Array.from(
      new Set(payload.geoTargets.map((target) => `${target.city}, ${target.state}`))
    ).slice(0, 3)
  };
}

function parseCommaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseImportLimit(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 200;
  }

  return Math.min(parsed, 5000);
}

function filterGeoTargetsByStates(targets: SiteProject["geoTargets"], selectedStates: string[]) {
  if (selectedStates.length === 0) {
    return targets;
  }

  const stateSet = new Set(selectedStates.map((state) => state.trim().toUpperCase()).filter(Boolean));
  return targets.filter((target) => stateSet.has(target.state.toUpperCase()));
}

function getPromptForPageType(pageType: string, prompts: PromptLibrary): string {
  switch (pageType) {
    case "homepage":
      return prompts.homepagePrompt;
    case "service":
      return prompts.servicePrompt;
    case "state":
    case "city":
    case "city-service":
      return prompts.locationPrompt;
    case "about":
      return prompts.aboutPrompt;
    case "contact":
      return prompts.contactPrompt;
    default:
      return prompts.homepagePrompt;
  }
}

function shouldImportGeoTargets(input: Record<string, string>) {
  return input.importGeoTargets === "on" && Boolean(input.mainNiche.trim());
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

