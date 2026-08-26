import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decodeJwtPayload, getFirebasePublicCerts } from "@/lib/services/firebase-auth";
import type { Role } from "@/generated/prisma/enums";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { idToken, accessToken, user } = body;

    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    // Decode ID Token payload
    const payload = decodeJwtPayload(idToken);
    if (!payload) {
      return NextResponse.json({ error: "Invalid ID Token format" }, { status: 400 });
    }

    const email = (payload.email || user?.email || "").toLowerCase();
    const googleSub = payload.sub || payload.user_id || user?.uid;

    if (!email || !googleSub) {
      return NextResponse.json(
        { error: "Token payload missing required email or subject ID" },
        { status: 400 }
      );
    }

    // Verify token expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return NextResponse.json({ error: "Token has expired" }, { status: 401 });
    }

    // Optionally fetch public certs to verify header & kid key availability
    try {
      await getFirebasePublicCerts();
    } catch (e) {
      console.warn("[Firebase Auth Route] Warning fetching public certs:", e);
    }

    // 1. Find DB User or Karyawan (STRICT: Reject unregistered users)
    let dbUser = await db.user.findUnique({
      where: { email },
      include: { karyawan: true },
    });

    const karyawan = await db.karyawan.findFirst({
      where: { email },
    });

    // If user is NOT registered in database, REJECT LOGIN!
    if (!dbUser && !karyawan) {
      return NextResponse.json(
        {
          error: `Email Google (${email}) belum terdaftar di sistem HRIS Potensi Creative. Silakan hubungi Administrator atau HRD untuk didaftarkan.`,
          code: "USER_NOT_REGISTERED",
        },
        { status: 403 }
      );
    }

    const targetRole: Role =
      karyawan?.kategori === "STREAMER" || karyawan?.jabatan?.toLowerCase().includes("streamer")
        ? "STREAMER"
        : (dbUser?.role as Role) || "STAFF";

    if (!dbUser && karyawan) {
      // Auto-link registered karyawan to user record with initial pin
      const { generateSalt, hashPin } = await import("@/lib/pin");
      const defaultSalt = generateSalt();
      const defaultPinHash = hashPin("123456", defaultSalt);

      dbUser = await db.user.create({
        data: {
          email,
          name: payload.name || user?.displayName || karyawan.namaLengkap || email.split("@")[0],
          image: payload.picture || user?.photoURL || null,
          role: targetRole,
          pinHash: defaultPinHash,
          pinSalt: defaultSalt,
          tenantId: karyawan.tenantId || null,
        },
        include: { karyawan: true },
      });
    } else if (dbUser) {
      // Sync role & ensure PIN hash/salt is present
      const { generateSalt, hashPin } = await import("@/lib/pin");
      let pinUpdateData: any = {};
      if (!dbUser.pinHash || !dbUser.pinSalt) {
        const defaultSalt = generateSalt();
        pinUpdateData.pinSalt = defaultSalt;
        pinUpdateData.pinHash = hashPin("123456", defaultSalt);
      }
      pinUpdateData.blockedUntil = null;
      pinUpdateData.failedLogins = 0;

      if (karyawan && (dbUser.role !== targetRole || !dbUser.karyawan)) {
        pinUpdateData.role = targetRole;
        pinUpdateData.tenantId = dbUser.tenantId || karyawan.tenantId || null;
      }

      dbUser = await db.user.update({
        where: { id: dbUser.id },
        data: pinUpdateData,
        include: { karyawan: true },
      });
    }

    if (karyawan && !karyawan.userId && dbUser) {
      await db.karyawan.update({
        where: { id: karyawan.id },
        data: { userId: dbUser.id },
      });
    }

    if (!dbUser) {
      return NextResponse.json(
        {
          error: `Email Google (${email}) belum terdaftar di sistem HRIS Potensi Creative. Silakan hubungi Administrator atau HRD.`,
          code: "USER_NOT_REGISTERED",
        },
        { status: 403 }
      );
    }

    // 2. Upsert Google Account OAuth Tokens into DB
    const account = await db.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: googleSub,
        },
      },
      create: {
        userId: dbUser.id,
        type: "oauth",
        provider: "google",
        providerAccountId: googleSub,
        access_token: accessToken || null,
        id_token: idToken,
        token_type: "Bearer",
        scope: "openid profile email https://www.googleapis.com/auth/calendar.events",
        expires_at: payload.exp ? Math.floor(payload.exp) : null,
      },
      update: {
        userId: dbUser.id,
        access_token: accessToken || undefined,
        id_token: idToken,
        expires_at: payload.exp ? Math.floor(payload.exp) : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Firebase Google Auth token stored successfully",
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        image: dbUser.image || payload.picture || null,
        role: dbUser.role,
        karyawanId: dbUser.karyawan?.id ?? null,
      },
      account: {
        id: account.id,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        hasAccessToken: Boolean(account.access_token),
      },
    });
  } catch (error: any) {
    console.error("[Firebase Auth Route] Error processing token:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process Firebase Auth token" },
      { status: 500 }
    );
  }
}
