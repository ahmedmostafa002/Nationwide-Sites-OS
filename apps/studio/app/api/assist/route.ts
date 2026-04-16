import { NextResponse } from "next/server";
import {
  buildFallbackSuggestion,
  requestAiSuggestion,
  type AssistKind,
  type AssistPayload
} from "../../../lib/ai-assist";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AssistPayload & { kind: AssistKind };

    if (!body.kind) {
      return NextResponse.json({ error: "Missing assist kind." }, { status: 400 });
    }

    const result = await requestAiSuggestion(body.kind, body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown assist error.";
    return NextResponse.json(
      {
        source: "fallback",
        note: message,
        data: {
          error: message
        }
      },
      { status: 500 }
    );
  }
}
