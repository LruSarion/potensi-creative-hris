import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { runJob, JOB_REGISTRY } from "@/lib/jobs/runner";

// Jobs are triggered by an external cron (or next/cron) hitting this endpoint.
// POST /api/jobs/run?job=payout-run
// Fail-closed: in production CRON_SECRET is REQUIRED; without it the endpoint refuses.
export async function POST(req: Request) {
  const url = new URL(req.url);
  const job = url.searchParams.get("job");

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Production must configure CRON_SECRET. Dev may run without it, but log a warning.
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ status: "error", message: "CRON_SECRET not configured" }, { status: 503 });
    }
    // Dev fallback: allow only when not production (still require the header if a secret exists).
  } else if (req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  if (!job || !(job in JOB_REGISTRY)) {
    throw AppError.badRequest("unknown job");
  }
  const result = await runJob(job as keyof typeof JOB_REGISTRY, JOB_REGISTRY[job as keyof typeof JOB_REGISTRY]);
  return NextResponse.json({ status: "success", data: result });
}