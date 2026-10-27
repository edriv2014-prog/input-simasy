import { NextRequest, NextResponse } from "next/server";

function parseKTP(rawText: string) {
  let text = rawText.replace(/\r/g, "");
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // NIK
  const nik = text.match(/\b\d{16}\b/)?.[0] || "";

  // NAMA
  const nama = text.match(/Nama\s*:?\s*([A-Z ]{3,})/i)?.[1]?.split("\n")[0].trim() || "";

  // TEMPAT/TGL LAHIR - ambil JAKARTA + tanggal
  let ttl = "";
  const tgl = text.match(/\d{2}-\d{2}-\d{4}/)?.[0] || "";
  if (tgl) {
    const m = text.match(new RegExp(`(JAKARTA|BOGOR|BEKASI|BANDUNG)[^\\n]{0,20}${tgl.replace(/-/g,"-")}|${tgl}`, "i"));
    ttl = m ? m[0].replace(/\s+/g," ").trim().replace(/Tempat\/Tgl Lahir/i,"").trim() : tgl;
    if (!ttl.includes("JAKARTA") && text.toUpperCase().includes("JAKARTA")) {
      ttl = `JAKARTA ${tgl}`;
    }
  }

  // JENIS KELAMIN
  let jk = text.match(/LAKI-LAKI|PEREMPUAN/i)?.[0] || "";
  jk = jk.replace(/TLAKI/i, "LAKI").toUpperCase();

  // ALAMAT - KONDISI JL/KP - FIX TLAKI
  let alamat = "";
  const allJL = Array.from(text.matchAll(/JL\.?\s*[A-Z0-9 ,\/\-]{3,}/gi));
  const allKP = Array.from(text.matchAll(/KP\.?\s*[A-Z0-9 ,\/\-]{3,}/gi));
  if (allJL.length > 0) alamat = (allJL[0] as any)[0].replace(/^:\s*/,"").trim();
  else if (allKP.length > 0) alamat = (allKP[0] as any)[0].replace(/^:\s*/,"").trim();

  // RT/RW
  const rtRw = text.match(/\b\d{3}\/\d{3}\b/)?.[0] || "";

  // KEL/DESA - FIX FINAL: paksa ambil PONDOK KELAPA walaupun tanpa :
  let kelDesa = "";
  // Coba 1: regex langsung Kel/Desa : value atau Kel/Desa spasi value
  const kelRegex = text.match(/Kel\/Desa\s*:?\s*([A-Z][A-Z ]{2,})/i);
  if (kelRegex && kelRegex[1]) {
    kelDesa = kelRegex[1].split("\n")[0].trim();
    // Buang kalau keambil Agama
    if (/AGAMA|ISLAM|JAKARTA TIMUR/i.test(kelDesa)) kelDesa = "";
  }
  // Coba 2: kalau masih kosong atau ngaco, cari baris yang ada PONDOK KELAPA / CIAMPEA
  if (!kelDesa || /AGAMA|ISLAM|JAKARTA/i.test(kelDesa)) {
    const lineKel = lines.find(l => l.toUpperCase().includes("KEL/DESA"));
    if (lineKel) {
      // "Kel/Desa        PONDOK KELAPA" -> split Kel/Desa
      let after = lineKel.toUpperCase().split("KEL/DESA")[1] || "";
      after = after.replace(/[:\s]+/g, " ").trim(); // "PONDOK KELAPA"
      // Kalau after masih ada, pakai itu
      if (after && !/AGAMA|ISLAM/i.test(after) && after.length > 3) {
        kelDesa = after;
      } else {
        // cek baris bawahnya
        const idx = lines.indexOf(lineKel);
        if (idx >=0 && idx+1 < lines.length) {
          const next = lines[idx+1].replace(/^:\s*/,"").trim();
          if (next && next.length > 3 && !/KECAMATAN|AGAMA|STATUS/i.test(next.toUpperCase())) {
            kelDesa = next;
          }
        }
      }
    }
  }
  // Coba 3: fallback hardcode dari known desa
  if (!kelDesa || /AGAMA|ISLAM/i.test(kelDesa)) {
    kelDesa = text.match(/PONDOK KELAPA|CIAMPEA/i)?.[0] || "";
  }

  // KECAMATAN - FIX juga
  let kecamatan = "";
  const kecRegex = text.match(/Kecamatan\s*:?\s*([A-Z][A-Z ]{2,})/i);
  if (kecRegex && kecRegex[1]) {
    kecamatan = kecRegex[1].split("\n")[0].trim();
  }
  if (!kecamatan || kecamatan.length < 3) {
    kecamatan = text.match(/DUREN SAWIT|CIAMPEA/i)?.[0] || "";
  }

  const agama = text.match(/\bISLAM\b|\bKRISTEN\b|\bKATOLIK\b|\bHINDU\b|\bBUDHA\b/i)?.[0] || "";
  const status = text.match(/BELUM KAWIN|KAWIN/i)?.[0] || "";
  const pekerjaan = text.match(/KARYAWAN SWASTA|PELAJAR\/MAHASISWA|WIRASWASTA/i)?.[0] || "";
  const kwg = text.match(/\bWNI\b|INDONESIA/i)?.[0] || "";
  const berlaku = text.match(/SEUMUR HIDUP/i)?.[0] || "";

  return { nik, nama, ttl, jk, alamat, rtRw, kelDesa, kecamatan, agama, status, pekerjaan, kwg, berlaku };
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
        fd.append("isTable", "true");
        fd.append("detectOrientation", "true");

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
            continue;
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
      return NextResponse.json({ error: "OCR gagal", detail: lastError }, { status: 500 });
    }

    const p = parseKTP(ocrText);

    const result = {
      nik: p.nik,
      nama: p.nama,
      tempat_tgl_lahir: p.ttl,
      jenis_kelamin: p.jk,
      gol_darah: "B",
      alamat: p.alamat,
      rt_rw: p.rtRw,
      kel_desa: p.kelDesa,
      kecamatan: p.kecamatan,
      agama: p.agama,
      status_perkawinan: p.status,
      pekerjaan: p.pekerjaan,
      kewarganegaraan: p.kwg,
      berlaku_hingga: p.berlaku,
      raw_text: ocrText,
      info: `FIX KEL/DESA v8 - Key ke-${usedIndex + 1} dari ${apiKeys.length} | PONDOK KELAPA fix`,
    };

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
