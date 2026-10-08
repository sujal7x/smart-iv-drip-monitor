import { NextResponse } from "next/server";

const ESP32_BASE_URL = "http://192.168.4.1";
const REQUEST_TIMEOUT_MS = 4_000;

type EspResult = {
  ok: boolean;
  value: unknown;
};

type WeightReading = { value: number; unit: "g" | "mL" };
type EspWeightResponse = { status?: string; weight_ml?: number | string; low_level?: boolean };

function extractWeight(value: unknown): WeightReading | null {
  if (typeof value === "number" && Number.isFinite(value)) return { value, unit: "g" };

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of ["weight", "weight_g", "weightG", "weight_ml", "weightMl", "value"]) {
      const candidate = record[key];
      const unit = key === "weight_ml" || key === "weightMl" ? "mL" : "g";
      if (typeof candidate === "number" && Number.isFinite(candidate)) return { value: candidate, unit };
      if (typeof candidate === "string") {
        const parsed = Number(candidate);
        if (Number.isFinite(parsed)) return { value: parsed, unit };
      }
    }
  }

  return null;
}

function parseWeightResponse(value: unknown): { reading: WeightReading | null; lowLevel: boolean | null } {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const payload = value as EspWeightResponse;
    const number = typeof payload.weight_ml === "number" ? payload.weight_ml : Number(payload.weight_ml);
    if (Number.isFinite(number)) {
      return { reading: { value: number, unit: "mL" }, lowLevel: typeof payload.low_level === "boolean" ? payload.low_level : null };
    }
  }

  return { reading: extractWeight(value), lowLevel: null };
}

async function requestEsp(path: string): Promise<EspResult> {
  try {
    const response = await fetch(`${ESP32_BASE_URL}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) return { ok: false, value: null };

    const text = await response.text();
    if (!text.trim()) return { ok: true, value: null };

    try {
      return { ok: true, value: JSON.parse(text) };
    } catch {
      const number = Number(text.trim());
      return { ok: true, value: Number.isFinite(number) ? number : text.trim() };
    }
  } catch {
    return { ok: false, value: null };
  }
}

export async function GET() {
  const [health, weight, status] = await Promise.all([
    requestEsp("/"),
    requestEsp("/weight"),
    requestEsp("/status"),
  ]);

  const parsedWeight = parseWeightResponse(weight.value);
  const weightReading = parsedWeight.reading ?? extractWeight(status.value);

  return NextResponse.json(
    {
      // Some ESP firmware builds expose /weight and /status before a separate
      // health route is available. Treat any successful telemetry response as
      // an active device instead of hiding otherwise valid readings.
      connected: health.ok || weight.ok || status.ok,
      health: health.value,
      weight: weightReading?.value ?? null,
      weightUnit: weightReading?.unit ?? "g",
      lowLevel: parsedWeight.lowLevel,
      status: status.value,
      updatedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
