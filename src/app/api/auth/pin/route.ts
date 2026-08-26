import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hashPin, verifyPin } from "@/lib/pin";
import { randomBytes } from "crypto";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, role: true, failedLogins: true, blockedUntil: true, pinHash: true },
  });

  return NextResponse.json({
    status: "success",
    data: {
      hasPin: Boolean(user?.pinHash),
      defaultPinHint: "PIN default sistem adalah: 1234",
      failedLogins: user?.failedLogins ?? 0,
      isBlocked: Boolean(user?.blockedUntil && user.blockedUntil > new Date()),
    },
  });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { currentPin, newPin, targetUserId, targetEmail } = body;

  if (!newPin || String(newPin).trim().length < 4) {
    return NextResponse.json(
      { status: "error", message: "PIN baru harus terdiri dari minimal 4 digit angka." },
      { status: 400 }
    );
  }

  const currentUser = await db.user.findUnique({
    where: { email: session.user.email },
  });

  if (!currentUser) {
    return NextResponse.json({ status: "error", message: "User tidak ditemukan." }, { status: 404 });
  }

  const isAdmin = currentUser.role === "SUPER_ADMIN" || currentUser.role === "ADMIN_OPERASIONAL";

  // CASE 1: Admin resetting PIN for another user
  if (targetUserId || targetEmail) {
    if (!isAdmin) {
      return NextResponse.json({ status: "error", message: "Hanya Admin yang dapat mereset PIN pengguna lain." }, { status: 403 });
    }

    const targetUser = await db.user.findFirst({
      where: targetUserId ? { id: targetUserId } : { email: targetEmail },
    });

    if (!targetUser) {
      return NextResponse.json({ status: "error", message: "Target user tidak ditemukan." }, { status: 404 });
    }

    const salt = randomBytes(16).toString("hex");
    const pinHash = hashPin(String(newPin).trim(), salt);

    await db.user.update({
      where: { id: targetUser.id },
      data: {
        pinHash,
        pinSalt: salt,
        failedLogins: 0,
        blockedUntil: null,
      },
    });

    return NextResponse.json({
      status: "success",
      message: `PIN untuk ${targetUser.email} berhasil diperbarui menjadi '${String(newPin).trim()}'.`,
    });
  }

  // CASE 2: User changing their own PIN
  if (!currentUser.pinHash || !currentUser.pinSalt) {
    // Setting PIN for first time
    const salt = randomBytes(16).toString("hex");
    const pinHash = hashPin(String(newPin).trim(), salt);
    await db.user.update({
      where: { id: currentUser.id },
      data: { pinHash, pinSalt: salt, failedLogins: 0, blockedUntil: null },
    });
    return NextResponse.json({ status: "success", message: "PIN berhasil dibuat!" });
  }

  // Verify current PIN before changing
  if (!currentPin) {
    return NextResponse.json(
      { status: "error", message: "Masukkan PIN lama Anda terlebih dahulu." },
      { status: 400 }
    );
  }

  const isCurrentValid = verifyPin(String(currentPin).trim(), currentUser.pinSalt, currentUser.pinHash);
  if (!isCurrentValid && !isAdmin) {
    return NextResponse.json(
      { status: "error", message: "PIN lama yang Anda masukkan salah." },
      { status: 400 }
    );
  }

  const salt = randomBytes(16).toString("hex");
  const pinHash = hashPin(String(newPin).trim(), salt);

  await db.user.update({
    where: { id: currentUser.id },
    data: { pinHash, pinSalt: salt, failedLogins: 0, blockedUntil: null },
  });

  return NextResponse.json({
    status: "success",
    message: "PIN keamanan Anda berhasil diubah!",
  });
}
