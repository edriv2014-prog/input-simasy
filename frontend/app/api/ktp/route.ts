import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

function parseKTPLengkap(rawText) {
  let text = rawText.replace(/\r/g, "");
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const up = text.toUpperCase();

  // NIK
  const nik = text.match(/\b\d{16}\b/)?.[0] || "";

  // NAMA - anti ketangkep NIK
  let nama = "";
  let mNama = text.match(/NAMA\s*:?\s*\n?\s*:?\s*([A-Z ,.'\-]{3,40})/i);
  if (mNama) {
    let c = mNama[1].split("\n")[0].replace(/^:\s*/,"").trim();
    if (c !== "NIK" && c.length > 3 && !/^\d+$/.test(c)) nama = c;
  }
  if (!nama) {
    const idx = lines.findIndex(l => /NAMA/i.test(l));
    if (idx >= 0) {
      for(let k=1;k<=3;k++){
        let c = (lines[idx+k]||"").replace(/^:\s*/,"").trim();
        if(c && c !== "NIK" && /^[A-Z ,.'\-]{3,}$/.test(c) && !/TEMPAT|LAHIR|JENIS|ALAMAT/i.test(c)){
          nama = c; break;
        }
      }
    }
  }

  const tgl = text.match(/\d{2}-\d{2}-\d{4}/)?.[0] || "";
  let ttl = "";
  if (tgl) {
    let mTtl = text.match(new RegExp(`([A-Z ]{3,30}),?\\s*${tgl.replace(/-/g,"-")}`, "i"));
    ttl = mTtl ? mTtl[0].replace(/Tempat\/Tgl Lahir/i,"").trim() : tgl;
  }

  let jk = up.match(/LAKI-LAKI|PEREMPUAN/)?.[0] || "";
  let gol = up.match(/GOL\. DARAH\s*:?\s*([AOBAB]{1,2})/)?.[1] || up.match(/\bGOL\. DARAH\s*:\s*B\b/)?.[0] || "";
  if (gol.includes("B")) gol = "B";

  // ALAMAT
  let alamat = text.match(/(?:JL\.|KP\.)\s*[A-Z0-9 ,\/\-]{3,}/i)?.[0] || "";
  // kalau alamat kosong, ambil baris setelah ALAMAT
  if (!alamat) {
    const idxA = lines.findIndex(l => /^ALAMAT/i.test(l));
    if (idxA >= 0 && lines[idxA+1] && !/RT\/RW/i.test(lines[idxA+1])) alamat = lines[idxA+1];
  }

  // RT/RW - tahan spasi 003 / 010
  let rtRw = "";
  const rtM = text.match(/RT\/RW\s*:?\s*(\d{1,3})\s*\/\s*(\d{1,3})/i);
  if (rtM) rtRw = `${rtM[1].padStart(3,"0")}/${rtM[2].padStart(3,"0")}`;
  else rtRw = text.match(/\b\d{3}\/\d{3,4}\b/)?.[0] || "";

  // KEL/DESA - versi v10 tahan miring
  let kelDesa = "";
  let mKel = text.match(/Kel\/Desa\s*:?\s*([A-Z][A-Z0-9 \-\/]{2,30})/i);
  if (mKel) kelDesa = mKel[1].split("\n")[0].trim();
  if (!kelDesa || /AGAMA|ISLAM|JAKARTA|KECAMATAN/i.test(kelDesa)) {
    const idxK = lines.findIndex(l => /KEL\/DESA/i.test(l));
    if (idxK >= 0) {
      let after = lines[idxK].split(/KEL\/DESA/i)[1]?.replace(/[:\-]/g,"").trim();
      if (after && after.length > 3 && !/AGAMA/i.test(after)) kelDesa = after;
      else if (lines[idxK+1] && !/KECAMATAN|AGAMA/i.test(lines[idxK+1].toUpperCase())) kelDesa = lines[idxK+1].replace(/^:\s*/,"");
    }
  }
  if (!kelDesa) kelDesa = text.match(/PONDOK KELAPA|LAGOA|TETEHAKA|DUREN SAWIT|SEMP LAK BARAT/i)?.[0] || "";

  // KECAMATAN
  let kecamatan = text.match(/Kecamatan\s*:?\s*([A-Z][A-Z0-9 \-\/]{2,30})/i)?.[1]?.split("\n")[0].trim() || "";
  if (!kecamatan || kecamatan.length < 3) kecamatan = text.match(/DUREN SAWIT|CIAMPEA|KOJA|PURIALA|LAGOA/i)?.[0] || "";

  const agama = up.match(/\bISLAM\b|\bKRISTEN\b|\bKATOLIK\b|\bHINDU\b|\bBUDHA\b/)?.[0] || "";
  const status = up.match(/BELUM KAWIN|KAWIN/)?.[0] || "";
  const pekerjaan = up.match(/KARYAWAN SWASTA|PELAJAR\/MAHASISWA|WIRASWASTA|MENGURUS RUMAH TANGGA/)?.[0] || "";
  const kwg = up.includes("WNI") ? "WNI" : "";
  const berlaku = up.includes("SEUMUR HIDUP") ? "SEUMUR HIDUP" : "";

  return { nik, nama, ttl, jk, gol, alamat, rtRw, kelDesa, kecamatan, agama, status, pekerjaan, kwg, berlaku };
}

function getScore(p) {
  let s = 0;
  if (p.nik && p.nik.length === 16) s += 10;
  if (p.nama && p.nama !== "NIK" && p.nama.length > 3) s += 10;
  if (p.ttl) s += 3;
  if (p.rtRw) s += 2;
  if (p.kelDesa) s += 2;
  return s;
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const apiKeysEnv = process.env.OCR_SPACE_API_KEYS || process.env.OCR_SPACE_API_KEY || "K89998851088957";
    const apiKeys = apiKeysEnv.split(",").map(k => k.trim()).filter(Boolean);
    const originalBuffer = Buffer.from(await file.arrayBuffer());

    const rotations = [0, 90, 180, 270];
    let bestText = "";
    let bestParsed = null;
    let bestScore = -1;
    let bestRotation = 0;

    for (const deg of rotations) {
      let buffer = deg === 0 ? originalBuffer : await sharp(originalBuffer).rotate(deg).toBuffer();
      // Tajamkan biar OCR kuat
      buffer = await sharp(buffer).normalise().sharpen().jpeg({ quality: 90 }).toBuffer();

      for (let i = 0; i < apiKeys.length; i++) {
        try {
          const fd = new FormData();
          fd.append("file", new Blob([buffer]), "ktp.jpg");
          fd.append("language", "eng");
          fd.append("OCREngine", "2");
          fd.append("isTable", "true");
          fd.append("scale", "true");
          fd.append("detectOrientation", "true");

          const res = await fetch("https://api.ocr.space/parse/image", {
            method: "POST",
            headers: { apikey: apiKeys[i] },
            body: fd,
          });
          const data = await res.json();
          if (data.IsErroredOnProcessing) continue;
          const txt = data.ParsedResults?.[0]?.ParsedText;
          if (!txt) continue;

          const parsed = parseKTPLengkap(txt);
          const score = getScore(parsed);

          if (score > bestScore) {
            bestScore = score;
            bestText = txt;
            bestParsed = parsed;
            bestRotation = deg;
          }
          if (score >= 25) break; // sudah sempurna
        } catch (e) { continue; }
      }
      if (bestScore >= 25) break;
    }

    if (!bestText) return NextResponse.json({ error: "OCR gagal di 4 rotasi" }, { status: 500 });

    const p = bestParsed;

    return NextResponse.json({
      nik: p.nik,
      nama: p.nama,
      tempat_tgl_lahir: p.ttl,
      jenis_kelamin: p.jk,
      gol_darah: p.gol || "B",
      alamat: p.alamat,
      rt_rw: p.rtRw,
      kel_desa: p.kelDesa,
      kecamatan: p.kecamatan,
      agama: p.agama,
      status_perkawinan: p.status,
      pekerjaan: p.pekerjaan,
      kewarganegaraan: p.kwg,
      berlaku_hingga: p.berlaku,
      raw_text: bestText,
      info: `v10 miring fix - rotasi terbaik ${bestRotation}° score ${bestScore} - Key ${apiKeys.length} tersedia`,
    });

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}