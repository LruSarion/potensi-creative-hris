import { apiHandler } from "@/lib/api-handler";
import { runMigration, previewMigration } from "@/lib/services/migration";

/**
 * POST /api/migration
 * { action: "preview", fileContent, fileName }  -> parse + preview (no write)
 * { action: "import", module, fileContent, fileName } -> parse + import
 */
export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  if (body.action === "preview") {
    return previewMigration({ fileContent: body.fileContent, fileName: body.fileName });
  }
  if (body.action === "import") {
    if (!body.module) throw new Error("module wajib diisi");
    return runMigration({ module: body.module, fileContent: body.fileContent, fileName: body.fileName });
  }
  throw new Error("unknown migration action");
});
