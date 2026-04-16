import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { geoTargetSchema, type GeoTarget } from "@nls/shared";

export type WorkbookSummary = {
  workbookPath: string | null;
  statusMessage: string;
  niches: Array<{
    sheetName: string;
    normalizedNiche: string;
    rowCount: number;
    sampleCities: string[];
  }>;
};

export type GeoImportPreview = {
  niche: string;
  availableCount: number;
  importedCount: number;
  states: string[];
  sampleCities: string[];
  topPayoutType: string;
};

export type GeoStateSnapshot = {
  state: string;
  targetCount: number;
  sampleCities: string[];
  averagePriorityScore: number;
  topPayoutType: string;
};

export type GeoTargetSnapshot = {
  niche: string;
  availableCount: number;
  states: GeoStateSnapshot[];
  targets: GeoTarget[];
};
type ZipLookup = {
  county: string;
  lat: number | null;
  lng: number | null;
  population: number | null;
  timezone: string;
};

let cachedWorkbook: XLSX.WorkBook | null = null;
let cachedWorkbookPath: string | null = null;
let cachedZipLookup: Map<string, ZipLookup> | null = null;
let cachedSummary: WorkbookSummary | null = null;
let workbookUnavailableReason: string | null = null;
let cachedSheetTargets: Map<string, GeoTarget[]> | null = null;

export async function getWorkbookSummary(): Promise<WorkbookSummary> {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    try {
        const client = createClient({
            url: tursoUrl,
            authToken: process.env.TURSO_AUTH_TOKEN
        });
        const rs = await client.execute(`
            SELECT DISTINCT niche FROM geo_targets
        `);
        const niches = await Promise.all(rs.rows.map(async (row) => {
            const niche = row.niche as string;
            const countRs = await client.execute({
                sql: "SELECT COUNT(*) as count FROM geo_targets WHERE niche = ?",
                args: [niche]
            });
            const sampleRs = await client.execute({
                sql: "SELECT DISTINCT city FROM geo_targets WHERE niche = ? LIMIT 3",
                args: [niche]
            });
            return {
                sheetName: niche,
                normalizedNiche: niche,
                rowCount: Number(countRs.rows[0].count),
                sampleCities: sampleRs.rows.map(r => r.city as string)
            };
        }));

        return {
            workbookPath: "Turso Cloud",
            statusMessage: "Connected to Turso Cloud database.",
            niches: niches.sort((a,b) => b.rowCount - a.rowCount)
        };
    } catch (error) {
        console.error("Turso workbook summary error:", error);
    }
  }


  if (cachedSummary) {
    return cachedSummary;
  }

  const workbookPath = findWorkbookPath();
  if (!workbookPath) {
    cachedSummary = {
      workbookPath: null,
      statusMessage:
        "No workbook detected yet. Add an .xlsx file at the project root or set WORKBOOK_PATH.",
      niches: []
    };
    return cachedSummary;
  }

  const workbook = loadWorkbook(workbookPath);
  if (!workbook) {
    cachedSummary = {
      workbookPath,
      statusMessage:
        workbookUnavailableReason ??
        "Workbook detected, but the studio could not read it right now.",
      niches: []
    };
    return cachedSummary;
  }

  const niches = workbook.SheetNames.filter((sheetName) => sheetName !== "uszips")
    .map((sheetName) => {
      const allRecords = normalizeSheet(sheetName);
      const records = allRecords.slice(0, 500);
      return {
        sheetName,
        normalizedNiche: normalizeNicheName(sheetName),
        rowCount: allRecords.length,
        sampleCities: Array.from(
          new Set(records.map((record) => record.city).filter(Boolean))
        ).slice(0, 3)
      };
    })
    .sort((a, b) => b.rowCount - a.rowCount);

  cachedSummary = {
    workbookPath,
    statusMessage: "Workbook loaded successfully.",
    niches
  };

  return cachedSummary;
}

export async function getGeoImportPreview(
  nicheName: string,
  limit: number
): Promise<GeoImportPreview | null> {
  const normalizedNiche = normalizeNicheName(nicheName);
  if (!normalizedNiche) {
    return null;
  }

  const snapshot = await getGeoTargetSnapshot(normalizedNiche, limit);

  if (!snapshot || snapshot.availableCount === 0) {
    return null;
  }

  const records = snapshot.targets;
  const states = snapshot.states.map(s => s.state).slice(0, 8);
  const sampleCities = Array.from(new Set(records.map((record) => record.city))).slice(0, 4);
  const topPayoutType = "CPL";

  return {
    niche: normalizedNiche,
    availableCount: snapshot.availableCount,
    importedCount: records.length,
    states,
    sampleCities,
    topPayoutType
  };
}

export function importGeoTargetsForNiche(
  nicheName: string,
  limit: number
): GeoTarget[] {
  return getAllGeoTargetsForNiche(nicheName).slice(0, Math.max(limit, 0));
}

export async function getGeoTargetSnapshot(
  nicheName: string,
  limit: number
): Promise<GeoTargetSnapshot | null> {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const normalizedNiche = normalizeNicheName(nicheName);
  
  console.log(`[GeoSnapshot] Requested: "${nicheName}", Normalized: "${normalizedNiche}"`);

  if (tursoUrl) {
    try {
        const client = createClient({
            url: tursoUrl,
            authToken: process.env.TURSO_AUTH_TOKEN
        });
        
        const countRs = await client.execute({
            sql: "SELECT COUNT(*) as count FROM geo_targets WHERE LOWER(niche) = LOWER(?)",
            args: [normalizedNiche]
        });

        const total = Number(countRs.rows[0].count);
        if (total === 0) return null;

        const stateRs = await client.execute({
            sql: `SELECT state, COUNT(*) as count, GROUP_CONCAT(city, '|') as cities 
                  FROM (SELECT state, city FROM geo_targets WHERE LOWER(niche) = LOWER(?) ORDER BY payout_raw DESC)
                  GROUP BY state ORDER BY count DESC`,
            args: [normalizedNiche]
        });

        const targetRs = await client.execute({
            sql: "SELECT * FROM geo_targets WHERE LOWER(niche) = LOWER(?) ORDER BY payout_raw DESC LIMIT ?",
            args: [normalizedNiche, limit]
        });



        const states: GeoStateSnapshot[] = stateRs.rows.map(r => ({
            state: r.state as string,
            targetCount: Number(r.count),
            sampleCities: (r.cities as string).split("|").slice(0, 3).map(c => c.charAt(0).toUpperCase() + c.slice(1)),
            averagePriorityScore: 100,
            topPayoutType: "CPL"
        }));

        const targets: GeoTarget[] = targetRs.rows.map(r => ({
            state: r.state as string,
            city: r.city as string,
            zip: r.zip as string,
            payout: r.payout as string,
            duration: r.duration as string,
            payoutValue: Number(r.payout_raw),
            durationSeconds: Number(r.duration_raw),
            population: 0, 
            priorityScore: 100,
            niche: nicheName,
            payoutType: "CPL",
            county: "",
            lat: null,
            lng: null,
            timezone: "UTC",
            payoutAmount: Number(r.payout_raw) || 0,
            sourceSheet: nicheName,
            dataConfidenceScore: 100
        }));


        return {
            niche: nicheName,
            availableCount: total,
            states,
            targets
        };
    } catch (error) {
        console.error("Turso snapshot error:", error);
    }
  }

  const normalizedNiche = normalizeNicheName(nicheName);
  if (!normalizedNiche) {
    return null;
  }

  const allTargets = getAllGeoTargetsForNiche(normalizedNiche);
  if (allTargets.length === 0) {
    return null;
  }

  // Return all targets to ensure selected states always have data available
  const targets = allTargets;
  const stateMap = new Map<string, GeoTarget[]>();

  for (const target of allTargets) {
    const bucket = stateMap.get(target.state) ?? [];
    bucket.push(target);
    stateMap.set(target.state, bucket);
  }

  const states = Array.from(stateMap.entries())
    .map(([state, records]) => ({
      state,
      targetCount: records.length,
      sampleCities: Array.from(new Set(records.map((record) => record.city))).slice(0, 3),
      averagePriorityScore:
        records.reduce((sum, record) => sum + record.priorityScore, 0) / records.length,
      topPayoutType:
        records.find((record) => record.payoutType)?.payoutType || "Mixed payout types"
    }))
    .sort((left, right) => right.targetCount - left.targetCount);

  return {
    niche: normalizedNiche,
    availableCount: allTargets.length,
    states,
    targets
  };
}
function getAllGeoTargetsForNiche(nicheName: string) {
  const workbookPath = findWorkbookPath();
  if (!workbookPath) {
    return [];
  }

  const workbook = loadWorkbook(workbookPath);
  if (!workbook) {
    return [];
  }

  const normalizedQuery = normalizeNicheName(nicheName);
  const matchedSheet = workbook.SheetNames.find((sheetName) => {
    const normalizedSheet = normalizeNicheName(sheetName);
    if (normalizedSheet === normalizedQuery) {
      return true;
    }

    if (
      normalizedSheet.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedSheet)
    ) {
      return true;
    }

    if (normalizedQuery.includes("plumbing") && normalizedSheet.includes("plumbing")) {
      return true;
    }

    if (normalizedQuery.includes("roofing") && normalizedSheet.includes("roof")) {
      return true;
    }

    if (normalizedQuery.includes("hvac") && normalizedSheet.includes("hvac")) {
      return true;
    }

    return false;
  });

  if (!matchedSheet) {
    return [];
  }

  return normalizeSheet(matchedSheet);
}

function loadWorkbook(workbookPath: string) {
  if (cachedWorkbook && cachedWorkbookPath === workbookPath) {
    return cachedWorkbook;
  }

  // Try to load from JSON first for faster performance
  const localJsonPath = resolve(process.cwd(), "data", "geo-targets.json");
  const rootJsonPath = resolve(process.cwd(), "..", "..", "data", "geo-targets.json");
  const relativeJsonPath = resolve(__dirname, "..", "data", "geo-targets.json");
  
  const jsonPath = existsSync(localJsonPath) 
    ? localJsonPath 
    : existsSync(rootJsonPath) 
      ? rootJsonPath 
      : existsSync(relativeJsonPath)
        ? relativeJsonPath
        : null;

  if (jsonPath) {
    console.log(`✓ Workbook Import: Found data at ${jsonPath}`);
    try {
      const jsonData = JSON.parse(readFileSync(jsonPath, "utf-8"));
      // Simulate XLSX.WorkBook structure
      cachedWorkbook = {
        SheetNames: Object.keys(jsonData),
        Sheets: {}
      };
      for (const sheetName of Object.keys(jsonData)) {
        cachedWorkbook.Sheets[sheetName] = XLSX.utils.json_to_sheet(jsonData[sheetName]);
      }
      cachedWorkbookPath = workbookPath;
      cachedZipLookup = buildZipLookup(cachedWorkbook);
      cachedSummary = null;
      cachedSheetTargets = new Map();
      workbookUnavailableReason = null;
      return cachedWorkbook;
    } catch (error) {
      // Fall back to Excel
    }
  }

  try {
    const workbookBuffer = readFileSync(workbookPath);
    cachedWorkbook = XLSX.read(workbookBuffer, {
      type: "buffer",
      cellDates: false,
      dense: true
    });
    cachedWorkbookPath = workbookPath;
    cachedZipLookup = buildZipLookup(cachedWorkbook);
    cachedSummary = null;
    cachedSheetTargets = new Map();
    workbookUnavailableReason = null;
    return cachedWorkbook;
  } catch (error) {
    cachedWorkbook = null;
    cachedWorkbookPath = workbookPath;
    cachedZipLookup = null;
    cachedSheetTargets = null;
    workbookUnavailableReason =
      error instanceof Error ? error.message : "Unknown workbook access error.";
    return null;
  }
}

function normalizeSheet(sheetName: string): GeoTarget[] {
  const workbookPath = findWorkbookPath();
  if (!workbookPath) {
    return [];
  }

  const workbook = loadWorkbook(workbookPath);
  if (!workbook) {
    return [];
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return [];
  }

  const cacheKey = `${cachedWorkbookPath ?? workbookPath}::${sheetName}`;
  const cachedTargets = cachedSheetTargets?.get(cacheKey);
  if (cachedTargets) {
    return cachedTargets;
  }

  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: ""
  });

  const headerRows = matrix.slice(0, 3).map((row) => row.map(normalizeCell));
  const rawRecords = new Map<string, GeoTarget>();

  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex]?.map(normalizeCell) ?? [];

    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      const zipValue = row[columnIndex];
      const payoutValue = row[columnIndex + 1] ?? "";
      const cityValue = row[columnIndex + 2] ?? "";
      const stateValue = row[columnIndex + 3] ?? "";

      if (!looksLikeZip(zipValue)) {
        continue;
      }

      if (!looksLikeCity(cityValue) || !looksLikeState(stateValue)) {
        continue;
      }

      const zip = normalizeZip(zipValue);
      const enrichment = cachedZipLookup?.get(zip);
      const payoutType = detectPayoutType(headerRows, columnIndex + 1);
      const payoutAmount = parseNumber(payoutValue);

      const record = geoTargetSchema.parse({
        niche: normalizeNicheName(sheetName),
        zip,
        city: toTitleCase(cityValue),
        state: stateValue.toUpperCase(),
        county: enrichment?.county ?? "",
        lat: enrichment?.lat ?? null,
        lng: enrichment?.lng ?? null,
        population: enrichment?.population ?? null,
        timezone: enrichment?.timezone ?? "",
        payoutType,
        payoutAmount,
        sourceSheet: sheetName,
        priorityScore: calculatePriorityScore(payoutAmount, enrichment?.population),
        dataConfidenceScore: calculateConfidenceScore({
          city: cityValue,
          state: stateValue,
          payoutAmount,
          enrichment
        })
      });

      rawRecords.set(
        [record.niche, record.zip, record.city, record.state, record.payoutType].join("::"),
        record
      );
    }
  }

  const normalizedTargets = Array.from(rawRecords.values()).sort((a, b) => {
    const payoutDiff = (b.payoutAmount ?? 0) - (a.payoutAmount ?? 0);
    if (payoutDiff !== 0) {
      return payoutDiff;
    }

    return b.priorityScore - a.priorityScore;
  });

  cachedSheetTargets?.set(cacheKey, normalizedTargets);
  return normalizedTargets;
}

function buildZipLookup(workbook: XLSX.WorkBook) {
  const sheet = workbook.Sheets.uszips;
  const lookup = new Map<string, ZipLookup>();

  if (!sheet) {
    return lookup;
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, string | number | boolean>>(sheet, {
    raw: false,
    defval: ""
  });

  for (const row of rows) {
    const zip = normalizeZip(String(row.zip ?? ""));
    if (!zip) {
      continue;
    }

    lookup.set(zip, {
      county: String(row.county_name ?? ""),
      lat: parseNumber(row.lat),
      lng: parseNumber(row.lng),
      population: parseNumber(row.population),
      timezone: String(row.timezone ?? "")
    });
  }

  return lookup;
}

function detectPayoutType(headerRows: string[][], payoutColumnIndex: number) {
  for (const headerRow of headerRows) {
    const value = headerRow[payoutColumnIndex];
    if (value && /(payout|offer)/i.test(value)) {
      return value;
    }
  }

  return "";
}

function calculatePriorityScore(
  payoutAmount: number | null,
  population: number | null | undefined
) {
  const payoutScore = payoutAmount ? Math.min(60, Math.round(payoutAmount / 4)) : 15;
  const populationScore = population
    ? Math.min(40, Math.round(Math.log10(Math.max(population, 10)) * 10))
    : 10;
  return clampScore(payoutScore + populationScore);
}

function calculateConfidenceScore(input: {
  city: string;
  state: string;
  payoutAmount: number | null;
  enrichment: ZipLookup | undefined;
}) {
  let score = 40;

  if (looksLikeCity(input.city)) {
    score += 20;
  }

  if (looksLikeState(input.state)) {
    score += 15;
  }

  if (input.payoutAmount !== null) {
    score += 10;
  }

  if (input.enrichment?.county) {
    score += 5;
  }

  if (input.enrichment?.timezone) {
    score += 5;
  }

  if (input.enrichment?.population) {
    score += 5;
  }

  return clampScore(score);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function findWorkbookPath() {
  if (cachedWorkbookPath && existsSync(cachedWorkbookPath)) {
    return cachedWorkbookPath;
  }

  const configured = process.env.WORKBOOK_PATH;
  if (configured) {
    const configuredPath = resolve(process.cwd(), configured);
    if (existsSync(configuredPath)) {
      cachedWorkbookPath = configuredPath;
      return configuredPath;
    }
  }

  const root = resolve(process.cwd(), "..", "..");
  const workbookName = readdirSync(root).find((entry) => entry.toLowerCase().endsWith(".xlsx"));

  if (!workbookName) {
    return null;
  }

  cachedWorkbookPath = resolve(root, workbookName);
  return cachedWorkbookPath;
}

function looksLikeZip(value: string) {
  const zip = normalizeZip(value);
  return zip.length === 5;
}

function looksLikeCity(value: string) {
  if (!value) {
    return false;
  }

  const lower = value.toLowerCase();
  return !["city", "#n/a", "n/a"].includes(lower);
}

function looksLikeState(value: string) {
  return /^[A-Za-z]{2}$/.test(value.trim());
}

function normalizeZip(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  return digits.padStart(5, "0").slice(-5);
}

function normalizeCell(value: unknown) {
  return String(value ?? "").trim();
}

function parseNumber(value: unknown) {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  if (!normalized) {
    return null;
  }

  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeNicheName(value: string) {
  let normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .trim();

  if (normalized.endsWith("-")) normalized = normalized.slice(0, -1);
  if (normalized.startsWith("-")) normalized = normalized.slice(1);


  normalized = normalized
    .replace(/\bplumber\b/g, "plumbing")
    .replace(/\bplumb\b/g, "plumbing")
    .replace(/\broofer\b/g, "roofing")
    .replace(/\bac repair\b/g, "hvac")
    .replace(/\bair conditioning\b/g, "hvac");

  return normalized;
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}










