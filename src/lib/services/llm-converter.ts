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

import { buildLlmPrompt } from "./converter-utils";

/** Resolve the OpenRouter API key + model from DB config (tenant) or env fallback. */
export async function resolveLlmConfig(tenantId?: string | null): Promise<{ apiKey: string; model: string; source: "tenant" | "env" | "none" }> {
  // Try tenant DB config first.
  if (tenantId) {
    try {
      const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
      const cfg = (tenant?.config ?? {}) as { llm?: { apiKey?: string; model?: string } };
      if (cfg.llm?.apiKey) {
        return {
          apiKey: cfg.llm.apiKey,
          model: cfg.llm.model || process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
          source: "tenant",
        };
      }
    } catch {
      // ignore
    }
  }
  if (process.env.OPENROUTER_API_KEY) {
    return { apiKey: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini", source: "env" };
  }
  return { apiKey: "", model: "openai/gpt-4o-mini", source: "none" };
}

interface LlmRow { [col: string]: string | number | null }
interface LlmResult { rows: LlmRow[] }

export async function callLlm(module: string, rawText: string, tenantId?: string | null): Promise<LlmResult | null> {
  const cfg = await resolveLlmConfig(tenantId);
  if (!cfg.apiKey) return null;
  const prompt = buildLlmPrompt(module, rawText);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
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
export async function convertWithBestEngine(module: string, rawText: string, tenantId?: string | null): Promise<Record<string, string>[]> {
  const user = await requireRole(...IMPORT_ROLES);
  void user;
  const cfg = await resolveLlmConfig(tenantId);
  // Try LLM first (only if a key is configured + text is non-empty).
  if (cfg.apiKey && rawText.length > 0) {
    const llmResult = await callLlm(module, rawText, tenantId);
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
