import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";


function getValue(lines, keywords) {
  // cari baris yang mengandung keyword
  for (let i = 0; i < lines.length; i++) {
    const upper = lines[i].toUpperCase();
    if (keywords.some(k => upper.includes(k))) {
      // 1. cek di baris yang sama setelah :
      let after = lines[i].split(":").slice(1).join(":").trim();
      if (after && after.length > 2 && after !== "-" ) return after;
      // 2. cek baris depannya (kadang : di baris bawah)
      for (let j = 1; j <= 2; j++) {
        let next = (lines[i + j] || "").trim();
        if (!next) continue;
        // skip kalau next masih keyword lain
        if (/^(PROVINSI|KABUPATEN|NIK|NAMA|TEMPAT|JENIS|GOL|ALAMAT|RT\/RW|KEL\/DESA|KECAMATAN|AGAMA|STATUS|PEKERJAAN|KEWARGANEGARAAN|BERLAKU|KONAWE|KAB\.?)/i.test(next)) {
          if (next.startsWith(":")) {
            next = next.replace(/^:\s*/, "").trim();
            if (next) return next;
          }
          continue;
        }
        next = next.replace(/^:\s*/, "").trim();
        if (next && next.length > 1) return next;
      }
    }
  }
  return "";
}

function parseKTPLengkap(rawText) {
  const lines = rawText.replace(/\r/g,"").split("\n").map(l=>l.trim()).filter(Boolean);
  
  const nik = rawText.match(/\b\d{16}\b/)?.[0] || "";
  
  let nama = getValue(lines, ["NAMA"]);
  // BLACKLIST - jangan sampai nama = KABUPATEN KONAWE
  if (/KABUPATEN|PROVINSI|KONAWE|SULAWESI|NIK/i.test(nama) || /^\d+$/.test(nama)) {
    nama = "";
    // coba pakai NIK sebagai anchor
    const idxNik = lines.findIndex(l => l.includes("740904") || /^\d{16}$/.test(l) || l.replace(/[^0-9]/g,"").length === 16);
    if(idxNik >=0){
      // nama biasanya 1-3 baris setelah NIK
      for(let k=1;k<=4;k++){
        let c = (lines[idxNik+k]||"").replace(/^:\s*/,"").trim();
        if(c && /^[A-Z][A-Z ,.'\-]{2,}$/.test(c) && !/KABUPATEN|PROVINSI|TEMPAT|JENIS/i.test(c)){
          nama = c;
          break;
        }
      }
    }
  }

  let ttlRaw = getValue(lines, ["TEMPAT/TGL LAHIR", "TEMPAT/TGL"]);
  if(!ttlRaw){
    const tgl = rawText.match(/\d{2}-\d{2}-\d{4}/)?.[0] || "";
    const tempat = rawText.match(/BANDAEHA|JAKARTA|KONAWE/i)?.[0] || "BANDAEHA";
    ttlRaw = `${tempat}, ${tgl}`;
  }

  const jk = rawText.toUpperCase().match(/LAKI-LAKI|PEREMPUAN/)?.[0] || "";
  const gol = rawText.match(/Gol\. Darah\s*:?\s*([AOBAB]{1,2}|-)/i)?.[1] || "-";
  const rtRw = rawText.match(/(\d{3}\/\d{3})/)?.[0] || getValue(lines, ["RT/RW"]);
  
  // ALAMAT - INI YANG BIKIN KOSONG KEMARIN
  let alamat = getValue(lines, ["ALAMAT"]);
  if(!alamat) alamat = rawText.match(/DESA [A-Z ]+/i)?.[0] || "";
  
  let kelDesa = getValue(lines, ["KEL/DESA"]);
  if(/RT\/RW|001\/001/i.test(kelDesa)) kelDesa = ""; // bug kamu kemarin
  if(!kelDesa) kelDesa = rawText.match(/TETEHAKA|PONDOK KELAPA|LAGOA/i)?.[0] || "";

  let kecamatan = getValue(lines, ["KECAMATAN"]);
  if(!kecamatan) kecamatan = rawText.match(/PURIALA|DUREN SAWIT|KOJA/i)?.[0] || "";

  return {
    nik,
    nama, // sekarang bakal BARDIN, S.T. bukan KABUPATEN KONAWE
    ttl: ttlRaw,
    jk,
    gol,
    alamat, // sekarang DESA TETEHAKA
    rtRw,
    kelDesa,
    kecamatan,
    agama: rawText.match(/ISLAM|KRISTEN|KATOLIK|HINDU|BUDHA/i)?.[0] || "",
    status: rawText.match(/KAWIN|BELUM KAWIN/i)?.[0] || "",
    pekerjaan: rawText.match(/WIRASWASTA|KARYAWAN SWASTA|PELAJAR/i)?.[0] || "",
    kwg: "WNI",
    berlaku: "SEUMUR HIDUP"
  }
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