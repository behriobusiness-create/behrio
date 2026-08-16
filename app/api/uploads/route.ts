import { getCurrentUser } from "@/lib/auth/current-user";
import { NextResponse } from "next/server";
import { getStorage, generateStorageKey } from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024;

const MIME_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
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

    let file: File | null = null;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const uploaded = form.get("file");
      file = uploaded instanceof File ? uploaded : null;
    } else {
      const body = await request.json();
      const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";
      if (dataUrl) {
        const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
        if (match) {
          file = new File([Buffer.from(match[2], "base64")], "upload", {
            type: match[1],
          });
        }
      }
    }

    if (!file) {
      return NextResponse.json(
        { error: "فایلی دریافت نشد." },
        { status: 400 }
      );
    }

    const ext = MIME_EXT[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: "فرمت تصویر نامعتبر است. فقط PNG، JPG یا WEBP مجاز است." },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "حجم تصویر باید کمتر از ۵ مگابایت باشد." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const storage = getStorage();
    const key = generateStorageKey(ext);

    const result = await storage.upload({
      data: buffer,
      mimeType: file.type,
      extension: ext,
      key,
    });

    return NextResponse.json({
      ok: true,
      url: result.url,
    });
  } catch (error) {
    console.error("Upload error:", error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "خطا در آپلود تصویر.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}