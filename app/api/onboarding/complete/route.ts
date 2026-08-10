import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type CompleteSignupBody =
  | {
      role: "CREATOR";
      displayName: string;
      bio?: string;
      instagramHandle?: string;
      telegramHandle?: string;
    }
  | {
      role: "BUSINESS";
      companyName: string;
      website?: string;
      description?: string;
    };

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as CompleteSignupBody;

    if (body.role !== "CREATOR" && body.role !== "BUSINESS") {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    const userId = user.id;

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        creatorProfile: true,
        businessProfile: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (body.role === "CREATOR") {
      if (!body.displayName?.trim()) {
        return NextResponse.json(
          { error: "Display name is required" },
          { status: 400 }
        );
      }

      if (existingUser.role !== null && existingUser.role !== "CREATOR") {
        return NextResponse.json(
          { error: "Account type has already been selected" },
          { status: 409 }
        );
      }

      if (existingUser.creatorProfile) {
        return NextResponse.json(
          { error: "Creator profile already exists" },
          { status: 409 }
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { role: "CREATOR" },
        });

        const profile = await tx.creatorProfile.create({
          data: {
            userId,
            displayName: body.displayName.trim(),
            bio: body.bio?.trim() || null,
            instagramHandle: body.instagramHandle?.trim() || null,
            telegramHandle: body.telegramHandle?.trim() || null,
          },
        });

        return { updatedUser, profile };
      });

      return NextResponse.json({
        ok: true,
        role: result.updatedUser.role,
        profile: result.profile,
      });
    }

    if (!body.companyName?.trim()) {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 }
      );
    }

    if (existingUser.role !== null && existingUser.role !== "BUSINESS") {
      return NextResponse.json(
        { error: "Account type has already been selected" },
        { status: 409 }
      );
    }

    if (existingUser.businessProfile) {
      return NextResponse.json(
        { error: "Business profile already exists" },
        { status: 409 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { role: "BUSINESS" },
      });

      const profile = await tx.businessProfile.create({
        data: {
          userId,
          companyName: body.companyName.trim(),
          website: body.website?.trim() || null,
          description: body.description?.trim() || null,
        },
      });

      return { updatedUser, profile };
    });

    return NextResponse.json({
      ok: true,
      role: result.updatedUser.role,
      profile: result.profile,
    });
  } catch (error) {
    console.error("Complete onboarding failed:", error);

    return NextResponse.json(
      { error: "Unable to complete onboarding" },
      { status: 500 }
    );
  }
}
