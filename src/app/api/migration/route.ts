import { apiHandler } from "@/lib/api-handler";
import { runMigration, previewMigration } from "@/lib/services/migration";

/**
 * POST /api/migration
 * { action: "preview", fileContent?, fileName?, googleSheetUrl? }  -> parse + preview (no write)
 * { action: "import", module, fileContent?, fileName?, googleSheetUrl? } -> parse + import
 */
export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
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
