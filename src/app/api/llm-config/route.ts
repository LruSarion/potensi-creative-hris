import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";

const ADMIN_ROLES = ["SUPER_ADMIN"] as const;

/**
 * LLM (OpenRouter) configuration — Super Admin only.
 * GET  -> return saved config (key masked) + whether a key is set.
 * POST -> save API key + selected model into the tenant's config.
 * GET /api/llm-config?models=1 -> fetch available models from OpenRouter (using the key).
 */
export const GET = apiHandler(async (req: Request) => {
  const user = await requireRole(...ADMIN_ROLES);
  const url = new URL(req.url);

  const tenant = await db.tenant.findUnique({ where: { id: user.tenantId ?? "" } });
  const cfg = (tenant?.config ?? {}) as { llm?: { apiKey?: string; model?: string } };
  const llm = cfg.llm ?? {};

  // Fetch available models from OpenRouter if a key is configured.
  if (url.searchParams.get("models") === "1") {
    const apiKey = llm.apiKey || process.env.OPENROUTER_API_KEY || "";
    if (!apiKey) return { configured: false, models: [] };
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
      });
      if (!res.ok) return { configured: true, models: [] };
      const data = await res.json();
      const models = (data?.data ?? [])
        .map((m: any) => m.id)
        .filter((id: string) => id.includes("gpt") || id.includes("claude") || id.includes("gemini") || id.includes("mistral") || id.includes("llama"))
        .slice(0, 50);
      return { configured: true, model: llm.model ?? null, models };
    } catch {
      return { configured: true, models: [] };
    }
  }

  return {
    configured: Boolean(llm.apiKey || process.env.OPENROUTER_API_KEY),
    hasSavedKey: Boolean(llm.apiKey),
    model: llm.model ?? process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
    source: llm.apiKey ? "tenant" : process.env.OPENROUTER_API_KEY ? "env" : "none",
  };
});

export const POST = apiHandler(async (req: Request) => {
  const user = await requireRole(...ADMIN_ROLES);
  if (!user.tenantId) throw new Error("Akun tidak terkait tenant");
  const body = await req.json();

  const tenant = await db.tenant.findUnique({ where: { id: user.tenantId } });
  const cfg = (tenant?.config ?? {}) as { llm?: { apiKey?: string; model?: string } };

  const next = {
    ...cfg,
    llm: {
      apiKey: typeof body.apiKey === "string" ? body.apiKey.trim() : (cfg.llm?.apiKey ?? ""),
      model: typeof body.model === "string" && body.model ? body.model : (cfg.llm?.model ?? "openai/gpt-4o-mini"),
    },
  };

  await db.tenant.update({ where: { id: user.tenantId }, data: { config: next } });
  return { ok: true, model: next.llm?.model, configured: Boolean(next.llm?.apiKey) };
});
