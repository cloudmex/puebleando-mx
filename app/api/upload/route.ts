import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const VALID_BUCKETS = ["events-images", "places-images"] as const;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    // Validar tipo y tamaño
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Formato no soportado. Usa JPG, PNG o WebP." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "La imagen excede 5 MB." }, { status: 400 });
    }

    // Bucket dinámico (default: events-images para backwards compat)
    const bucketParam = (formData.get("bucket") as string) || "events-images";
    const bucket = VALID_BUCKETS.includes(bucketParam as any) ? bucketParam : "events-images";

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseServerClient(true);
      if (supabase) {
        const { error } = await supabase.storage
          .from(bucket)
          .upload(fileName, buffer, { contentType: file.type });

        if (error) {
           console.error("[upload] Supabase error:", error);
           return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const { data: publicUrlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(fileName);

        return NextResponse.json({ url: publicUrlData.publicUrl });
      }
    }

    // Fallback: Local file system para desarrollo
    const uploadDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    const filePath = join(uploadDir, fileName);
    await writeFile(filePath, buffer);
    return NextResponse.json({ url: `/uploads/${fileName}` });
  } catch (error: any) {
    console.error("[upload] Error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
