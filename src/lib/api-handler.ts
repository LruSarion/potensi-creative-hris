import { NextResponse } from "next/server";
import { AppError, toAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { ZodError } from "zod";

/**
 * Wrap an API route handler so thrown AppErrors become structured JSON
 * responses and unexpected errors are logged + returned as 500.
 * Zod validation errors are mapped to 400 (never 500).
 * Compatible with Next.js 16 route handler signature (params is a Promise).
 */
export function apiHandler<T>(
  fn: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<T>
) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      const data = await fn(req, ctx);
      // If the handler returned a raw Response/NextResponse (e.g. CSV download,
      // file stream, redirect), return it as-is instead of wrapping it.
      if (data instanceof Response) return data;
      return NextResponse.json({ status: "success", data });
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          { status: "error", code: "VALIDATION_ERROR", message: "Payload tidak valid.", issues: err.issues },
          { status: 400 }
        );
      }
      const appErr = toAppError(err);
      if (appErr.status >= 500) {
        logger.error("API error", { code: appErr.code, message: appErr.message });
      }
      return NextResponse.json(
        { status: "error", code: appErr.code, message: appErr.message },
        { status: appErr.status }
      );
    }
  };
}

export { AppError };
