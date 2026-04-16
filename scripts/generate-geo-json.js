import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Google Sheets CSV export URLs
const SPREADSHEET_ID = "1nzrsEJUYnQ7U2pk7jt9ubUVDiA4v_NXwU3_QFh9dLu4";

// Define your sheet GIDs (tab IDs) - you need to get these from the Google Sheet URL
// Example: for each tab, right-click > "Get link to this tab" and extract gid=XXXX
const SHEETS = {
  plumbing: "0",
  electrical: "246757697",
  "water-damage": "1927003159",
  "mold-removal": "987873247",
  roofing: "1365123742",
  biohazard: "1792455303",
  hvac: "935195521",
  "air-duct-cleaning": "210245943",
  appliance: "142522957",
  "garage-doors": "1623518088",
  "bathroom-remodeling": "1313920274",
  "kitchen-remodeling": "1289376711",
  "flooring-cpl": "273587420",
  windows: "923258681",
  "lawn-care-and-landscaping": "1112756448",
  "tree-services": "1953189877",
  siding: "1443279820",
  painting: "1487473219",
  "pest-control-duration": "519159696"
};

async function fetchSheetCSV(sheetName, gid) {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${sheetName}: ${response.status}`);
  }
  return await response.text();
}

function csvToJson(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.replace(/"/g, '').trim());
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = values[i] || '';
    });
    return obj;
  });

  return rows;
}

async function generateGeoTargets() {
  const data = {};

  for (const [sheetName, gid] of Object.entries(SHEETS)) {
    console.log(`Fetching sheet: ${sheetName}`);
    try {
      const csvText = await fetchSheetCSV(sheetName, gid);
      data[sheetName] = csvToJson(csvText);
      console.log(`✓ Loaded ${data[sheetName].length} rows for ${sheetName}`);
    } catch (error) {
      console.error(`✗ Failed to load ${sheetName}:`, error.message);
    }
  }

  const outputDirArg = process.argv[2];
  const outputDir = outputDirArg ? resolve(process.cwd(), outputDirArg) : resolve(process.cwd(), "data");
  
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const outputPath = resolve(outputDir, "geo-targets.json");
  writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`✓ Generated ${outputPath} from Google Sheets`);
}

generateGeoTargets().catch(console.error);