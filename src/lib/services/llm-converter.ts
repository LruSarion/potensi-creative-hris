import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/auth-helpers";
import type { Role } from "@/generated/prisma/enums";

const IMPORT_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "FINANCE", "FINANCE_MANAGER"];

/**
 * OpenRouter LLM converter — hybrid, opt-in via OPENROUTER_API_KEY.
 * Given messy free text (from sheets, photos, emails), the LLM extracts clean
 * rows mapped to the target module. Fails soft: if the key is missing or the
 * call fails, callers fall back to the heuristic converter.
 */

export const LLM_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
export const llmConfigured = Boolean(process.env.OPENROUTER_API_KEY);

import { buildLlmPrompt } from "./converter-utils";

interface LlmRow { [col: string]: string | number | null }
interface LlmResult { rows: LlmRow[] }

export async function callLlm(module: string, rawText: string): Promise<LlmResult | null> {
  if (!llmConfigured) return null;
  const prompt = buildLlmPrompt(module, rawText);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    // Strip code fences just in case.
    const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as LlmResult;
    return Array.isArray(parsed?.rows) ? parsed : null;
  } catch {
    return null; // fail-soft
  }
}

/**
 * Convert messy text to module rows using the LLM if configured, else heuristic.
 * Returns rows (as {header: value}) ready for the module importers.
 */
export async function convertWithBestEngine(module: string, rawText: string): Promise<Record<string, string>[]> {
  const user = await requireRole(...IMPORT_ROLES);
  void user;
  // Try LLM first (only if configured + text is messy/large).
  if (llmConfigured && rawText.length > 0) {
    const llmResult = await callLlm(module, rawText);
    if (llmResult && llmResult.rows.length > 0) {
      // Normalize values to strings.
      return llmResult.rows.map((r) =>
        Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v == null ? "" : String(v).trim()]))
      );
    }
  }
  // Fallback: try heuristic delimiter parse.
  const { parsePastedText } = await import("./migration");
  return parsePastedText(rawText).rows;
}
