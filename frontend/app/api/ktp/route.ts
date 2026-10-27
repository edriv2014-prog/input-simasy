import { NextRequest, NextResponse } from "next/server";

function getAlamatKondisi(text: string): string {
  const upper = text.toUpperCase();
  let alamat = "";

  // KONDISI 1: Ada JL.
  if (upper.includes("JL.") || upper.match(/JL\s/)) {
    const m = text.match(/JL\.?\s*[A-Z0-9 .,\/\-]{3,}/i);
    if (m) alamat = m[0];
  }
  // KONDISI 2: Ada KP.
  if (!alamat && (upper.includes("KP.") || upper.includes("KP "))) {
    const m = text.match(/KP\.?\s*[A-Z0-9 .,\/\-]{3,}/i);
    if (m) alamat = m[0];
  }
  // KONDISI 3: Fallback - ambil baris Alamat tapi BERSIHIN sampah LAKI/PEREMPUAN
  if (!alamat) {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toUpperCase().includes("ALAMAT")) {
        // cek 3 baris setelahnya, cari yang ada JL/KP atau bukan LAKI
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          const cand = lines[j].replace(/^:\s*/, "").trim();
          if (!cand) continue;
          // skip kalau isinya jenis kelamin
          if (/^(TLAKI-LAKI|LAKI-LAKI|PEREMPUAN)$/i.test(cand.replace(/:/g,"").trim())) continue;
          // kalau ketemu JL/KP, itu alamat
          if (/JL\.|KP\./i.test(cand)) {
            alamat = cand;
            break;
          }
          // kalau bukan RT/RW, bukan Kel/Desa, anggap alamat
          if (!/RT\/RW|KEL\/DESA|KECAMATAN|GOL\.?\s*DARAH/i.test(cand) && cand.length > 3) {
            alamat = cand;
            break;
          }
        }
      }
    }
  }

  return alamat
    .replace(/^:\s*/, "")
    .replace(/TLAKI-LAKI|LAKI-LAKI|PEREMPUAN/gi, "")
    .replace(/TLAKI/gi, "")
    .trim()
    .replace(/\s+/g, " ");
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const apiKeysEnv = process.env.OCR_SPACE_API_KEYS || process.env.OCR_SPACE_API_KEY || "K89998851088957";
    const apiKeys = apiKeysEnv.split(",").map(k => k.trim()).filter(Boolean);
    
    let ocrText = "";
    let usedIndex = -1;
    let lastError = "";

    for (let i = 0; i < apiKeys.length; i++) {
      const key = apiKeys[i];
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("language", "eng");
        fd.append("OCREngine", "2");
        fd.append("detectOrientation", "true");
        fd.append("isTable", "true");

        const res = await fetch("https://api.ocr.space/parse/image", {
          method: "POST",
          headers: { apikey: key },
          body: fd as any,
        });
        const data = await res.json();
        
        if (data.IsErroredOnProcessing) {
          const errMsg = data.ErrorMessage?.join(" ") || "";
          if (/E101|E122|limit|apikey/i.test(errMsg)) {
            lastError = errMsg;
            continue; // coba key berikutnya
          } else {
            throw new Error(errMsg);
          }
        }
        const parsed = data.ParsedResults?.[0]?.ParsedText;
        if (parsed) {
          ocrText = parsed;
          usedIndex = i;
          break;
        }
      } catch (e: any) {
        lastError = e.message;
        continue;
      }
    }

    if (!ocrText) {
      return NextResponse.json({ error: "OCR gagal semua key", detail: lastError }, { status: 500 });
    }

    // Normalisasi biar : tidak pisah baris
    let text = ocrText.replace(/\r/g, "").replace(/\n\s*:\s*/g, ": ").replace(/:\s*\n\s*/g, ": ");

    const get = (labels: string[]) => {
      for (const lb of labels) {
        const regex = new RegExp(lb + "\\s*:?\\s*([^\\n]+)", "i");
        const m = text.match(regex);
        if (m && m[1]) {
          let v = m[1].trim();
          if (v.length > 2 && !/PROVINSI|KABUPATEN|KOTA/i.test(v)) return v;
        }
      }
      return "";
    };

    const nik = text.match(/\b\d{16}\b/)?.[0] || "";
    const nama = get(["Nama"]);
    const tempatTgl = get(["Tempat/Tgl Lahir", "Tempat\\/Tgl Lahir", "TTL"]);
    const jkRaw = text.match(/LAKI-LAKI|PEREMPUAN/i)?.[0] || "";
    const jenisKelamin = jkRaw.replace(/TLAKI/i, "LAKI").toUpperCase() === "LAKI-LAKI" ? "LAKI-LAKI" : (jkRaw || get(["Jenis Kelamin"]));
    
    // ALAMAT PAKAI KONDISI - FIX TLAKI
    const alamat = getAlamatKondisi(text);
    
    const golDarah = get(["Gol. Darah", "Gol Darah"]);
    const rtRw = text.match(/\b\d{3}\/\d{3}\b/)?.[0] || get(["RT/RW"]);
    const kelDesa = get(["Kel/Desa", "Kel\\/Desa"]);
    const kecamatan = get(["Kecamatan"]);
    const agama = get(["Agama"]) || (text.match(/ISLAM|KRISTEN|KATOLIK|HINDU|BUDHA|KONGHUCU/i)?.[0] || "");
    const status = get(["Status Perkawinan"]) || (text.match(/KAWIN|BELUM KAWIN|CERAI/i)?.[0] || "");
    const pekerjaan = get(["Pekerjaan"]);
    const kewarganegaraan = get(["Kewarganegaraan"]) || (text.match(/WNI|INDONESIA/i)?.[0] || "");
    const berlaku = get(["Berlaku Hingga"]);

    const result = {
      nik,
      nama,
      tempat_tgl_lahir: tempatTgl,
      jenis_kelamin: jenisKelamin,
      gol_darah: golDarah,
      alamat,
      rt_rw: rtRw,
      kel_desa: kelDesa,
      kecamatan,
      agama,
      status_perkawinan: status,
      pekerjaan,
      kewarganegaraan,
      berlaku_hingga: berlaku,
      raw_text: ocrText,
      info: `FIX KONDISI v6 - Berhasil pakai Key ke-${usedIndex + 1} dari ${apiKeys.length}`,
    };

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
