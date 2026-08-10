import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";

const VALID_ROLES = ["CREATOR", "BUSINESS"] as const;

type Role = (typeof VALID_ROLES)[number];

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    const role = typeof body.role === "string" ? body.role.trim().toUpperCase() : "";

    if ((!phone && !email) || !role) {
      return NextResponse.json(
        { error: "Phone or email and role are required" },
        { status: 400 }
      );
    }

    if (!VALID_ROLES.includes(role as Role)) {
      return NextResponse.json({ error: "Role must be CREATOR or BUSINESS" }, { status: 400 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (currentUser.role !== null) {
      return NextResponse.json({ error: "Account already has a role" }, { status: 409 });
    }

    if (phone && currentUser.phone !== phone) {
      return NextResponse.json({ error: "Phone does not match the verified session" }, { status: 403 });
    }

    if (email && currentUser.email !== email) {
      return NextResponse.json({ error: "Email does not match the verified session" }, { status: 403 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data: { role: role as Role },
    });

    return NextResponse.json({
      ok: true,
      message: "Account created successfully",
      user: {
        id: updatedUser.id,
        phone: updatedUser.phone,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status,
      },
    });
  } catch (error) {
    console.error("Complete signup failed:", error);
    return NextResponse.json({ error: "Unable to complete signup" }, { status: 500 });
  }
}
