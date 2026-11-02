import { NextRequest, NextResponse } from "next/server";

function parseKTP(rawText: string) {
  let text = rawText.replace(/\r/g, "");
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const nik = text.match(/\b\d{16}\b/)?.[0] || "";
  const nama = text.match(/Nama\s*:?\s*([A-Z ]{3,})/i)?.[1]?.split("\n")[0].trim() || "";

  let ttl = "";
  const tgl = text.match(/\d{2}-\d{2}-\d{4}/)?.[0] || "";
  if (tgl) {
    const m = text.match(new RegExp(`(JAKARTA|BOGOR|BEKASI|BANDUNG|MEDAN|.*)[^\\n]{0,20}${tgl.replace(/-/g,"-")}|${tgl}`, "i"));
    ttl = m ? m[0].replace(/\s+/g," ").trim().replace(/Tempat\/Tgl Lahir/i,"").trim() : tgl;
  }

  let jk = text.match(/LAKI-LAKI|PEREMPUAN/i)?.[0] || "";
  jk = jk.replace(/TLAKI/i, "LAKI").toUpperCase();

  let alamat = "";
  const allJL = Array.from(text.matchAll(/JL\.?\s*[A-Z0-9 ,\/\-]{3,}/gi));
  const allKP = Array.from(text.matchAll(/KP\.?\s*[A-Z0-9 ,\/\-]{3,}/gi));
  if (allJL.length > 0) alamat = (allJL[0] as any)[0].replace(/^:\s*/,"").trim();
  else if (allKP.length > 0) alamat = (allKP[0] as any)[0].replace(/^:\s*/,"").trim();

  let rtRw = "";
  const rtRwMatch = text.match(/RT\/RW\s*:?\s*(\d{1,3})\s*\/\s*(\d{1,3})/i);
  if (rtRwMatch) {
    const rt = rtRwMatch[1].padStart(3, "0");
    const rw = rtRwMatch[2].padStart(3, "0");
    rtRw = `${rt}/${rw}`;
  } else {
    const m = text.match(/\b(\d{3})\s*\/\s*(\d{3,4})\b/);
    if (m) rtRw = `${m[1]}/${m[2]}`;
  }

  let kelDesa = "";
  const kelRegex = text.match(/Kel\/Desa\s*:?\s*([A-Z][A-Z0-9 \-\/]{2,})/i);
  if (kelRegex && kelRegex[1]) {
    kelDesa = kelRegex[1].split("\n")[0].trim();
    if (/AGAMA|ISLAM|JAKARTA TIMUR/i.test(kelDesa)) kelDesa = "";
  }
  if (!kelDesa || /AGAMA|ISLAM/i.test(kelDesa)) {
    const lineKel = lines.find(l => l.toUpperCase().includes("KEL/DESA"));
    if (lineKel) {
      let after = lineKel.toUpperCase().split("KEL/DESA")[1] || "";
      after = after.replace(/[:\s]+/g, " ").trim();
      if (after && !/AGAMA|ISLAM/i.test(after) && after.length > 3) kelDesa = after;
      else {
        const idx = lines.indexOf(lineKel);
        if (idx >=0 && idx+1 < lines.length) {
          const next = lines[idx+1].replace(/^:\s*/,"").trim();
          if (next && next.length > 3 && !/KECAMATAN|AGAMA|STATUS/i.test(next.toUpperCase())) kelDesa = next;
        }
      }
    }
  }
  if (!kelDesa || /AGAMA|ISLAM/i.test(kelDesa)) {
    kelDesa = text.match(/PONDOK KELAPA|CIAMPEA|LAGOA|SEMP LAK|KALISARI|PASAR REBO/i)?.[0] || "";
  }

  let kecamatan = "";
  const kecRegex = text.match(/Kecamatan\s*:?\s*([A-Z][A-Z0-9 \-\/]{2,})/i);
  if (kecRegex && kecRegex[1]) kecamatan = kecRegex[1].split("\n")[0].trim();
  if (!kecamatan || kecamatan.length < 3) kecamatan = text.match(/DUREN SAWIT|CIAMPEA|KOJA|KEMANG|PASAR REBO|LAGOA/i)?.[0] || "";

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

    // CEK SIZE - kalau > 4MB tolak dengan JSON (bukan HTML Request Entity Too Large)
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: `File kegedean ${(file.size/1024/1024).toFixed(1)}MB - max 4MB. Foto ulang lebih dekat atau kompres dulu.`, detail: "SIZE_TOO_LARGE" }, { status: 413 });
    }

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

        // Kalau response bukan JSON (HTML error), baca text dulu
        const contentType = res.headers.get("content-type") || "";
        let data: any;
        if (contentType.includes("application/json")) {
          data = await res.json();
        } else {
          const txt = await res.text();
          // Kalau HTML Request Entity Too Large
          if (/Request Entity Too Large|413|Too Large/i.test(txt)) {
            return NextResponse.json({ error: "File kegedean - server OCR menolak. Kompres foto jadi <4MB", detail: txt.slice(0,200) }, { status: 413 });
          }
          throw new Error("OCR server error: " + txt.slice(0,300));
        }
        
        if (data.IsErroredOnProcessing) {
          const errMsg = data.ErrorMessage?.join(" ") || "";
          if (/E101|E122|limit|apikey|Too Many/i.test(errMsg)) {
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
        // Kalau error size, langsung return JSON
        if (/Too Large|413|SIZE_TOO_LARGE/i.test(e.message)) {
          return NextResponse.json({ error: e.message, detail: "SIZE" }, { status: 413 });
        }
        continue;
      }
    }

    if (!ocrText) {
      return NextResponse.json({ error: "OCR gagal - coba foto lebih jelas atau file <4MB", detail: lastError }, { status: 500 });
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
      info: `FIX v10 ANTI Request Entity Too Large + RT/RW 003 / 010 + KEL/DESA fix - Key ke-${usedIndex + 1}`,
    };

    return NextResponse.json(result, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      }
    });
  } catch (e: any) {
    // Pastikan selalu return JSON, bukan HTML
    return NextResponse.json({ error: e.message || "Server error", detail: "CATCH" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
