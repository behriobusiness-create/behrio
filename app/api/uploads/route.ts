import { getCurrentUser } from "@/lib/auth/current-user";
import { NextResponse } from "next/server";
import { getStorage, generateStorageKey } from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024;

const MIME_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

function decodeDataUrl(dataUrl: string): { buffer: Buffer; ext: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;

  const mime = match[1];
  const ext = MIME_EXT[mime];
  if (!ext) return null;

  const buffer = Buffer.from(match[2], "base64");
  return { buffer, ext };
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "احراز هویت انجام نشده است." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";

    const decoded = decodeDataUrl(dataUrl);

    if (!decoded) {
      return NextResponse.json(
        { error: "فرمت تصویر نامعتبر است. فقط PNG، JPG یا WEBP مجاز است." },
        { status: 400 }
      );
    }

    if (decoded.buffer.length > MAX_BYTES) {
      return NextResponse.json(
        { error: "حجم تصویر باید کمتر از ۵ مگابایت باشد." },
        { status: 400 }
      );
    }

    const storage = getStorage();
    const key = generateStorageKey(decoded.ext);

    const result = await storage.upload({
      data: decoded.buffer,
      mimeType: decoded.ext === ".png" ? "image/png" : decoded.ext === ".jpg" ? "image/jpeg" : "image/webp",
      extension: decoded.ext,
      key,
    });

    return NextResponse.json({
      ok: true,
      url: result.url,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "خطا در آپلود تصویر." },
      { status: 500 }
    );
  }
}