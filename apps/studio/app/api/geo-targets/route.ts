import { NextResponse } from "next/server";
import { getGeoTargetSnapshot } from "../../../lib/workbook-import";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const niche = searchParams.get("niche") ?? "";
  const limit = Number(searchParams.get("limit") ?? "120");

  if (!niche.trim()) {
    return NextResponse.json({ error: "Missing niche." }, { status: 400 });
  }

  const snapshot = await getGeoTargetSnapshot(niche, Number.isFinite(limit) ? limit : 120);

  if (!snapshot) {
    return NextResponse.json({ error: "No geo targets found for that niche." }, { status: 404 });
  }

  return NextResponse.json(snapshot);
}

