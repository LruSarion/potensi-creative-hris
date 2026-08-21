import { apiHandler } from "@/lib/api-handler";
import { runMigration, previewMigration, parsePastedText } from "@/lib/services/migration";
import { convertWithBestEngine, resolveLlmConfig } from "@/lib/services/llm-converter";
import { requireRole } from "@/lib/auth-helpers";

/**
 * POST /api/migration
 * { action: "preview", fileContent?, fileName?, googleSheetUrl?, pastedText? }  -> parse + preview (no write)
 * { action: "convert", module, pastedText } -> LLM/heuristic conversion
 * { action: "import", module, fileContent?, fileName?, googleSheetUrl?, pastedText? } -> parse + import
 */
export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  const user = await requireRole("SUPER_ADMIN", "ADMIN_OPERASIONAL", "FINANCE", "FINANCE_MANAGER");
  const llmCfg = await resolveLlmConfig(user.tenantId);

  // Paste-text source: use the hybrid converter (LLM via OpenRouter when
  // configured, else heuristic delimiter detection).
  if (body.pastedText) {
    if (body.action === "convert" && body.module) {
      const rows = await convertWithBestEngine(body.module, body.pastedText, user.tenantId);
      return { engine: llmCfg.source !== "none" ? "llm" : "heuristic", rows, rowCount: rows.length, preview: rows.slice(0, 5) };
    }
    const parsed = parsePastedText(body.pastedText);
    const csv = [parsed.headers.join("\t"), ...parsed.rows.map((r) => parsed.headers.map((h) => r[h] ?? "").join("\t"))].filter(Boolean).join("\n");
    body.fileContent = csv;
    body.fileName = "pasted.tsv";
  }

  if (body.action === "preview") {
    return previewMigration({
      fileContent: body.fileContent,
      fileName: body.fileName,
      googleSheetUrl: body.googleSheetUrl,
    });
  }
  if (body.action === "import") {
    if (!body.module) throw new Error("module wajib diisi");
    return runMigration({
      module: body.module,
      fileContent: body.fileContent,
      fileName: body.fileName,
      googleSheetUrl: body.googleSheetUrl,
    });
  }
  throw new Error("unknown migration action");
});
