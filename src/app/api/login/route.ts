import { NextResponse } from "next/server";
import { completeLogin } from "@/lib/login";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = body?.email;
    const pin = body?.pin;
    if (!email || !pin) {
      return NextResponse.json(
        { status: "error", message: "Email atau PIN tidak valid." },
        { status: 400 }
      );
    }
    const result = await completeLogin(email, pin);
    if (result.status === "success") {
      return NextResponse.json({ status: "success", data: result.user });
    }
    return NextResponse.json({ status: "error", message: result.message }, { status: 401 });
  } catch {
    return NextResponse.json(
      { status: "error", message: "Koneksi error." },
      { status: 500 }
    );
  }
}
