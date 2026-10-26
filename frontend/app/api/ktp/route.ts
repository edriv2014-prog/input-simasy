
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const keys = (process.env.OCR_SPACE_API_KEYS || "K89998851088957")
      .split(",")
      .map(k => k.trim())
      .filter(Boolean);

    let resultData: any = null;
    let usedIndex = -1;
    let lastError = "";

    for (let i = 0; i < keys.length; i++) {
      const apiKey = keys[i];
      try {
        const ocrForm = new FormData();
        ocrForm.append("apikey", apiKey);
        ocrForm.append("language", "eng");
        ocrForm.append("isOverlayRequired", "false");
        ocrForm.append("OCREngine", "2");
        ocrForm.append("detectOrientation", "true");
        ocrForm.append("isTable", "false");
        ocrForm.append("file", file);

        const ocrRes = await fetch("https://api.ocr.space/parse/image", {
          method: "POST",
          body: ocrForm,
        });

        const result = await ocrRes.json();

        if (result.IsErroredOnProcessing) {
          const msg = result.ErrorMessage?.[0] || "";
          if (
            msg.toLowerCase().includes("limit") ||
            msg.includes("E101") ||
            msg.includes("E122") ||
            msg.toLowerCase().includes("apikey") ||
            msg.toLowerCase().includes("not allowed")
          ) {
            lastError = msg;
            console.log(`Key ${i+1} habis: ${msg}`);
            continue;
          } else {
            return NextResponse.json({ error: msg, raw: result }, { status: 500 });
          }
        }

        resultData = result;
        usedIndex = i;
        break;
      } catch (e: any) {
        lastError = e.message;
        continue;
      }
    }

    if (!resultData) {
      return NextResponse.json(
        { error: `Semua ${keys.length} key penuh/limit. Last: ${lastError}` },
        { status: 429 }
      );
    }

    const text: string = resultData.ParsedResults?.[0]?.ParsedText || "";

    const nik = text.match(/NIK\s*:?\s*(\d{16})/i)?.[1] || "";
    const nama = (text.match(/lami\s*:?\s*([A-Z,\.\s]+)/i)?.[1] || text.match(/Nama\s*:?\s*([A-Z\s]+)/i)?.[1] || "").trim();
    const ttl = (text.match(/Tempat\/Tgl Lahir\s*:?\s*([A-Z0-9\-\/\s]+)/i)?.[1] || text.match(/Tempal Tgl Lahir\s*:?\s*([A-Z,\s\-0-9]+)/i)?.[1] || "").trim();
    const jk = text.match(/Jenis kelamin\s*:?\s*(LAKI-LAKI|PEREMPUAN)/i)?.[1] || "";
    const alamat = text.match(/Alamat\s*:?\s*(.+)/i)?.[1]?.trim() || "";
    const rtrw = (text.match(/RT\/RW\s*:?\s*([\d\/]+)/i)?.[1] || text.match(/Rt\/AW\s*:?\s*([\d\/]+)/i)?.[1] || "").trim();
    const kel = text.match(/Kel\/Desa\s*:?\s*([A-Z\s]+)/i)?.[1]?.trim() || "";
    const kec = text.match(/Kecamatan\s*:?\s*([A-Z\s]+)/i)?.[1]?.trim() || "";

    return NextResponse.json({
      NIK: nik || "Tidak terbaca",
      nama: nama || "Tidak terbaca",
      ttl: ttl || "Tidak terbaca",
      jenis_kelamin: jk || "Tidak terbaca",
      alamat: alamat || "Tidak terbaca",
      rtrw: rtrw || "Tidak terbaca",
      kel_desa: kel,
      kecamatan: kec,
      raw_text: text,
      info: `Berhasil pakai Key ke-${usedIndex + 1} dari ${keys.length} key`,
      key_used: usedIndex + 1,
      total_keys: keys.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
