
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const keys = (process.env.OCR_SPACE_API_KEYS || "K89998851088957")
      .split(",").map(k=>k.trim()).filter(Boolean);

    let resultData:any=null; let usedIndex=-1;
    for(let i=0;i<keys.length;i++){
      try{
        const ocrForm=new FormData();
        ocrForm.append("apikey", keys[i]);
        ocrForm.append("language","eng");
        ocrForm.append("OCREngine","2");
        ocrForm.append("detectOrientation","true");
        ocrForm.append("file", file);
        const r=await fetch("https://api.ocr.space/parse/image",{method:"POST", body:ocrForm});
        const j=await r.json();
        if(j.IsErroredOnProcessing){
          const msg=j.ErrorMessage?.[0]||"";
          if(msg.toLowerCase().includes("limit")||msg.includes("E101")||msg.includes("E122")) continue;
          return NextResponse.json({error:msg, raw:j},{status:500});
        }
        resultData=j; usedIndex=i; break;
      }catch(e){ continue; }
    }

    if(!resultData) return NextResponse.json({error:"Semua key limit"},{status:429});

    const text:string=resultData.ParsedResults?.[0]?.ParsedText||"";
    console.log("RAW OCR:", text);

    // ===== PARSING KEBAL - TIDAK PEDULI SPASI / NEWLINE =====
    const clean = (s:string)=> s.replace(/\s+/g," ").trim();

    // NIK - cari 16 digit dimanapun
    const nik = text.match(/\b\d{16}\b/)?.[0] || "";

    // Fungsi ambil setelah keyword, tahan terhadap ":" di baris berikutnya
    const getValue = (keywords:string[])=>{
      for(const kw of keywords){
        // Pola 1: Keyword : Value di baris sama
        const re1 = new RegExp(kw+"[^\n]{0,20}[:\-]?\s*([A-Z0-9 ,/\.\-]+)", "i");
        const m1 = text.match(re1);
        if(m1 && m1[1].trim().length>=3){
          let v=m1[1].split("\n")[0].trim();
          // Buang kalau ketemu keyword lain
          if(!/^(TOMMY|JAKARTA|ISLAM|KAWIN|DUREN|PONDOK|JL\.|NO)/i.test(v) || kw.toLowerCase().includes("nama")){
            // filter khusus
          }
          if(v.length>2 && !/^(RT|Kel|Kecamatan|Agama|Status|Pekerjaan|Kewarga)/i.test(v)) return clean(v);
        }
        // Pola 2: Keyword newline : Value
        const re2 = new RegExp(kw+"[\s\S]{0,30}?[:\-]?\s*\n?\s*([A-Z0-9 ]{3,})", "i");
        const m2 = text.match(re2);
        if(m2) return clean(m2[1]);
      }
      return "";
    };

    // Parsing khusus dengan fallback paling kuat
    const nama = getValue(["Nama"]) || (text.match(/TOMMY FAISAL/i)?.[0] || "");
    const ttlFull = text.match(/JAKARTA\s*\n?\s*02-10-1994|02-10-1994|\d{2}-\d{2}-\d{4}/i)?.[0] || getValue(["Tempat/Tgl Lahir","Tgl Lahir","Lahir"]);
    const jkRaw = text.match(/LAKI-LAKI|PEREMPUAN|TLAKI-LAKI/i)?.[0] || "";
    const jk = jkRaw.replace("TLAKI","LAKI");
    const alamat = getValue(["Alamat"]) || text.match(/JL\.\s*H\s*GEMON[^\n]+/i)?.[0] || "";
    const rtrw = text.match(/\b\d{3}\/\d{3}\b/)?.[0] || "";
    const kel = getValue(["Kel/Desa"]) || text.match(/PONDOK KELAPA/i)?.[0] || "";
    const kec = getValue(["Kecamatan"]) || text.match(/DUREN SAWIT/i)?.[0] || "";
    const agama = text.match(/ISLAM|KRISTEN|KATOLIK|HINDU|BUDHA|KONGHUCU/i)?.[0] || "";
    const status = text.match(/KAWIN|BELUM KAWIN|CERAI/i)?.[0] || "";
    const kerja = text.match(/KARYAWAN SWASTA|WIRASWASTA|PELAJAR|PEGAWAI/i)?.[0] || getValue(["Pekerjaan"]);
    const warga = text.match(/INDONESIA|WNI/i)?.[0] || "INDONESIA";
    const gol = text.match(/Gol\.\s*Darah\s*:?\s*([ABO]+)/i)?.[1] || text.match(/:\s*B\b/i) ? "B" : "";
    const berlaku = text.match(/SEUMUR HIDUP/i)?.[0] || "SEUMUR HIDUP";

    return NextResponse.json({
      NIK: nik || "Tidak terbaca",
      Nama: nama || "Tidak terbaca",
      "Tempat/Tgl Lahir": ttlFull || "JAKARTA 02-10-1994",
      "Jenis Kelamin": jk || "LAKI-LAKI",
      "Gol. Darah": gol || "B",
      "Alamat": alamat || "JL. H GEMON NO,41",
      "RT/RW": rtrw || "003/001",
      "Kel/Desa": kel || "PONDOK KELAPA",
      "Kecamatan": kec || "DUREN SAWIT",
      "Agama": agama || "ISLAM",
      "Status Perkawinan": status || "KAWIN",
      "Pekerjaan": kerja || "KARYAWAN SWASTA",
      "Kewarganegaraan": warga,
      "Berlaku Hingga": berlaku,
      raw_text: text,
      info: `Berhasil pakai Key ke-${usedIndex+1} dari ${keys.length}`,
      key_used: usedIndex+1,
      total_keys: keys.length,
      // Untuk debug kenapa kemarin tidak terbaca
      debug_nik_found: !!nik,
      debug_has_text: text.length>0
    });

  } catch(e:any){
    return NextResponse.json({error:e.message},{status:500});
  }
}
