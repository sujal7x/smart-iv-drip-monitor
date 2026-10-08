import { NextResponse } from "next/server";

const ESP32_BASE_URL = "http://192.168.4.1";
const REQUEST_TIMEOUT_MS = 5_000;

export async function POST(request: Request) {
  let action: unknown;

  try {
    ({ action } = await request.json());
  } catch {
    return NextResponse.json({ error: "A flow action is required." }, { status: 400 });
  }

  if (action !== "clamp" && action !== "open" && action !== "plus10" && action !== "minus10") {
    return NextResponse.json({ error: "Unsupported flow action." }, { status: 400 });
  }

  try {
    const response = await fetch(`${ESP32_BASE_URL}/${action}`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "The ESP32 rejected the servo command." }, { status: 502 });
    }

    const status = action === "clamp" ? "clamped" : action === "open" ? "open" : action;
    return NextResponse.json({ action, status });
  } catch {
    return NextResponse.json({ error: "The ESP32 is unreachable. Confirm the device Wi-Fi connection." }, { status: 503 });
  }
}
