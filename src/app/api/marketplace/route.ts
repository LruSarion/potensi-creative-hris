import { apiHandler } from "@/lib/api-handler";
import {
  listEligibleListings,
  applyToListing,
  listApplications,
  decideApplication,
  listListings,
  createListing,
  setListingStatus,
  listCertifications,
  listShortlist,
  toggleShortlist,
  listPipeline,
  getKeranjangJobs,
  getHistoryMarketJobs,
  takeMarketplaceJob,
  cancelMarketplaceJob,
  finalizeKeranjangMassal,
} from "@/lib/services/marketplace";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "eligible";
  const listingId = url.searchParams.get("listingId") ?? undefined;
  const hostId = url.searchParams.get("hostId") ?? url.searchParams.get("karyawanId") ?? undefined;

  if (view === "eligible") return listEligibleListings();
  if (view === "listings") return listListings();
  if (view === "applications" && listingId) return listApplications(listingId);
  if (view === "certifications") return listCertifications();
  if (view === "shortlist") return listShortlist();
  if (view === "pipeline") return listPipeline();
  if (view === "keranjang") return getKeranjangJobs(hostId);
  if (view === "history_market" || view === "historyMarket") return getHistoryMarketJobs(hostId);
  return listEligibleListings();
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  const action = body.action as string | undefined;

  if (action === "apply") return applyToListing(body.listingId, body.note);
  if (action === "takeMarketplaceJob" || action === "take") return takeMarketplaceJob(body.listingId || body.TARGET_ID || body.idMarketplace);
  if (action === "cancelMarketplaceJob" || action === "cancel") return cancelMarketplaceJob(body.listingId || body.TARGET_ID || body.idMarketplace);
  if (action === "finalizeKeranjangMassal" || action === "finalize" || action === "finalizeKeranjang") {
    const ids: string[] = body.TARGET_IDS || body.listingIds || body.ids || [];
    return finalizeKeranjangMassal(ids);
  }
  if (action === "create-listing") return createListing(body.listing);
  if (action === "decide") return decideApplication(body.applicationId, body.decision);
  if (action === "toggle-shortlist") return toggleShortlist(body.streamerKaryawanId);
  throw new Error("unknown marketplace action");
});

export const PATCH = apiHandler(async (req: Request) => {
  const body = await req.json();
  if (body.action === "set-status") return setListingStatus(body.id, body.status);
  throw new Error("unknown marketplace patch action");
});
