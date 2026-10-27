
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const keys = (process.env.OCR_SPACE_API_KEYS || "K89998851088957")
      .split(",").map(k=>k.trim()).filter(Boolean);

    let resultData:any=null; let usedIndex=-1; let lastError="";
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
          if(msg.toLowerCase().includes("limit")||msg.includes("E101")||msg.includes("E122")){
            lastError=msg; continue;
          }
          return NextResponse.json({error:msg},{status:500});
        }
        resultData=j; usedIndex=i; break;
      }catch(e:any){ lastError=e.message; continue; }
    }

    if(!resultData) return NextResponse.json({error:`Semua ${keys.length} key limit. ${lastError}`},{status:429});

    const text:string=resultData.ParsedResults?.[0]?.ParsedText||"";

    // Parsing urutan KTP
    const get = (re:RegExp)=> text.match(re)?.[1]?.trim() || "";
    const nik = get(/NIK\s*:?\s*(\d{16})/i);
    const nama = get(/Nama\s*:?\s*([A-Z\s]+)/i) || get(/lami\s*:?\s*([A-Z,\.\s]+)/i);
    const ttl = get(/Tempat\/Tgl Lahir\s*:?\s*([A-Z0-9\-\/\s,]+)/i) || get(/Tempat\/Tgl Lahir\s*JAKARTA\s*([0-9\-\/]+)/i) || get(/Lahir\s*([A-Z0-9\-\/\s]+)/i);
    const jk = get(/Jenis Kelamin\s*:?\s*(LAKI-LAKI|PEREMPUAN|LAKI|TLAKI-LAKI)/i) || get(/Jenis\s*Kelamin\s*([A-Z\-]+)/i);
    const gol = get(/Gol\.\s*Darah\s*:?\s*([ABO]+)/i) || get(/Gol Darah\s*:?\s*([ABO]+)/i);
    const alamat = get(/Alamat\s*:?\s*(.+)/i);
    const rtrw = get(/RT\/RW\s*:?\s*([\d\/]+)/i) || get(/Rt\/AW\s*:?\s*([\d\/]+)/i);
    const kel = get(/Kel\/Desa\s*:?\s*([A-Z\s]+)/i) || get(/Kel\/Desa\s*\n?\s*([A-Z\s]+)/i);
    const kec = get(/Kecamatan\s*:?\s*([A-Z\s]+)/i);
    const agama = get(/Agama\s*:?\s*([A-Z]+)/i);
    const status = get(/Status Perkawinan\s*:?\s*([A-Z\s]+)/i);
    const pekerjaan = get(/Pekerjaan\s*:?\s*([A-Z\s]+)/i);
    const warga = get(/Kewarganegaraan\s*:?\s*([A-Z]+)/i) || "INDONESIA";
    const berlaku = get(/Berlaku Hingga\s*:?\s*([A-Z0-9\s]+)/i) || "SEUMUR HIDUP";

    return NextResponse.json({
      NIK: nik || "Tidak terbaca",
      nama: nama || "Tidak terbaca",
      ttl: ttl || "Tidak terbaca",
      jenis_kelamin: jk.replace("TLAKI","LAKI") || "Tidak terbaca",
      gol_darah: gol || "-",
      alamat: alamat || "Tidak terbaca",
      rtrw: rtrw || "Tidak terbaca",
      kel_desa: kel || "-",
      kecamatan: kec || "-",
      agama: agama || "-",
      status_kawin: status || "-",
      pekerjaan: pekerjaan || "-",
      kewarganegaraan: warga,
      berlaku: berlaku,
      raw_text: text,
      info: `Berhasil pakai Key ke-${usedIndex+1} dari ${keys.length}`,
      key_used: usedIndex+1,
      total_keys: keys.length
    });

  } catch(e:any){ return NextResponse.json({error:e.message},{status:500}); }
}
