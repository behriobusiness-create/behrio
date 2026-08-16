import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "auto";
export const revalidate = 31536000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;

    const file = await prisma.storedFile.findUnique({
      where: { key },
    });

    if (!file) {
      return new NextResponse("Not Found", { status: 404 });
    }

    return new NextResponse(
      new Uint8Array(file.data) as unknown as BodyInit,
      {
        headers: {
          "Content-Type": file.mimeType,
          "Content-Length": String(file.size),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      }
    );
  } catch (error) {
    console.error("Serve file error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}