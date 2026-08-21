import { apiHandler } from "@/lib/api-handler";
import { rateExperience } from "@/lib/services/streamer-experience";

/**
 * Client rates a completed streamer experience + leaves a testimonial.
 * POST /api/experience-rate { experienceId, rating, testimonial }
 */
export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  return rateExperience(body.experienceId, Number(body.rating), body.testimonial);
});
