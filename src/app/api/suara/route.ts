import { apiHandler } from "@/lib/api-handler";
import { submitSuara, listSuara } from "@/lib/services/suara";

export const GET = apiHandler(async () => {
  return listSuara();
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  return submitSuara(body);
});
