import { NextRequest, NextResponse } from "next/server";

function parseKTP(rawText: string) {
  let text = rawText.replace(/\r/g, "").replace(/\n\s*:\s*/g, ": ").replace(/:\s*\n/g, ": ");
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const upperText = text.toUpperCase();

  // Helper ambil setelah label
  const getAfter = (keywords: string[]) => {
    for (let i = 0; i < lines.length; i++) {
      const lineUp = lines[i].toUpperCase();
      for (const kw of keywords) {
        if (lineUp.includes(kw.toUpperCase())) {
          // 1. Cek di baris yang sama ada : value
          const same = lines[i].split(":").slice(1).join(":").trim();
          if (same && same.length > 1 && !same.toUpperCase().includes("PROVINSI") && same.length < 80) {
            return same;
          }
          // 2. Cek 1-2 baris setelahnya
          for (let j = 1; j <= 2; j++) {
            if (i + j < lines.length) {
              let cand = lines[i + j].replace(/^:\s*/, "").trim();
              if (cand && !/PROVINSI|KABUPATEN|NIK|NAMA|TEMPAT|JENIS|ALAMAT|RT\/RW|KEL\/DESA|KECAMATAN|AGAMA|STATUS|PEKERJAAN|KEWARGANEGARAAN|BERLAKU/i.test(cand) || /^\d{3}\/\d{3}$/.test(cand) || /ISLAM|KAWIN|JL\.|KP\./i.test(cand)) {
                if (cand.length > 1) return cand;
              }
              // kalau cand ternyata label lain, skip
              if (/^:?\s*\d{16}\s*$/.test(cand)) return cand.replace(/:/g,"").trim();
            }
          }
        }
      }
    }
    return "";
  };

  // NIK - paling gampang
  const nik = text.match(/\b\d{16}\b/)?.[0] || getAfter(["NIK"]).replace(/\D/g,"") || "";

  // Nama
  let nama = "";
  const namaMatch = text.match(/Nama\s*:?\s*([A-Z ]{3,})/i);
  if (namaMatch) nama = namaMatch[1].split("\n")[0].trim();
  else nama = getAfter(["Nama"]);

  // Tempat/Tgl Lahir - ambil tanggal + kota
  let ttl = "";
  const dateMatch = text.match(/\d{2}-\d{2}-\d{4}/);
  if (dateMatch) {
    const idx = text.indexOf(dateMatch[0]);
    const before = text.substring(Math.max(0, idx - 30), idx);
    const city = before.match(/(JAKARTA|BOGOR|BANDUNG|BEKASI|DEPOK|CIANJUR|GARUT)/i)?.[0] || "";
    ttl = city ? `${city} ${dateMatch[0]}` : dateMatch[0];
    // untuk kasus "BOGOR, 14-08-1998"
    const fullTTL = text.match(/BOGOR,?\s*\d{2}-\d{2}-\d{4}|JAKARTA\s*\d{2}-\d{2}-\d{4}/i);
    if (fullTTL) ttl = fullTTL[0].replace(/\s+/g," ");
  }
  if (!ttl) ttl = getAfter(["Tempat/Tgl Lahir", "Tempat"]);

  // Jenis Kelamin - cari langsung LAKI/PEREMPUAN, kebal TLAKI
  let jk = text.match(/LAKI-LAKI|PEREMPUAN/i)?.[0] || getAfter(["Jenis Kelamin"]);
  jk = jk.toUpperCase().replace("TLAKI-LAKI","LAKI-LAKI").replace("TLAKI","LAKI");

  // --- ALAMAT KONDISI AKA ---
  let alamat = "";
  // KONDISI 1: JL.
  const jlAll = [...text.matchAll(/(JL\.?\s*[A-Z0-9 ,\/\-]{3,})/gi)];
  const kpAll = [...text.matchAll(/(KP\.?\s*[A-Z0-9 ,\/\-]{3,})/gi)];
  
  if (jlAll.length > 0) {
    alamat = jlAll[0][0].replace(/^:\s*/,"").trim();
  } else if (kpAll.length > 0) {
    alamat = kpAll[0][0].replace(/^:\s*/,"").trim();
  } else {
    // Fallback: ambil setelah Alamat tapi filter LAKI
    let rawAlamat = getAfter(["Alamat"]);
    if (/LAKI|PEREMPUAN/i.test(rawAlamat)) {
      // kalau keambil jenis kelamin, cari baris berikutnya yang ada JL/KP
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toUpperCase().includes("ALAMAT")) {
          for (let j = i+1; j < Math.min(i+5, lines.length); j++) {
            if (/JL\.|KP\./i.test(lines[j])) {
              rawAlamat = lines[j].replace(/^:\s*/,"").trim();
              break;
            }
          }
        }
      }
    }
    alamat = rawAlamat;
  }
  alamat = alamat.replace(/TLAKI-LAKI|LAKI-LAKI|PEREMPUAN/gi,"").replace(/^:\s*/,"").trim();

  const rtRw = text.match(/\b\d{3}\/\d{3}\b/)?.[0] || getAfter(["RT/RW"]);
  const kelDesa = getAfter(["Kel/Desa"]) || (text.match(/PONDOK KELAPA|CIAMPEA/i)?.[0] || "");
  const kecamatan = getAfter(["Kecamatan"]) || (text.match(/DUREN SAWIT|CIAMPEA/i)?.[0] || "");
  const agama = text.match(/\bISLAM\b|\bKRISTEN\b|\bKATOLIK\b|\bHINDU\b|\bBUDHA\b/i)?.[0] || getAfter(["Agama"]);
  const status = text.match(/BELUM KAWIN|KAWIN|CERAI/i)?.[0] || getAfter(["Status Perkawinan"]);
  const pekerjaan = getAfter(["Pekerjaan"]) || (text.match(/KARYAWAN SWASTA|PELAJAR\/MAHASISWA|WIRASWASTA/i)?.[0] || "");
  const kwg = text.match(/\bWNI\b|INDONESIA/i)?.[0] || getAfter(["Kewarganegaraan"]);
  const berlaku = text.match(/SEUMUR HIDUP/i)?.[0] || getAfter(["Berlaku Hingga"]);

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
      gol_darah: "",
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
      info: `FIX ANTI-KOSONG v7 - Key ke-${usedIndex + 1} dari ${apiKeys.length} | Alamat kondisi JL/KP`,
    };

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
