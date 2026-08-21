import { apiHandler } from "@/lib/api-handler";
import { telegramStatus, createTelegramBindLink, telegramDisconnect } from "@/lib/services/telegram";

export const GET = apiHandler(async () => telegramStatus());

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  const action = body.action as string | undefined;
  if (action === "connect") return createTelegramBindLink();
  if (action === "disconnect") return telegramDisconnect();
  throw new Error("unknown telegram action");
});
