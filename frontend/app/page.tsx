"use client";
import { useState } from "react";
import { createWorker } from "tesseract.js";

export default function Page(){
  const [preview,setPreview]=useState<string|null>(null);
  const [hasil,setHasil]=useState<any>(null);
  const [loading,setLoading]=useState(false);

  const handleUpload = async (e:any)=>{
    const file=e.target.files?.[0]; if(!file) return;
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    try{
      const worker = await createWorker('ind');
      const {data:{text}} = await worker.recognize(file);
      await worker.terminate();

      const nik = text.match(/\b\d{16}\b/)?.[0] || "";
      const nama = text.match(/Nama\s*:\s*([A-Z ]+)/i)?.[1] || "";
      
      const parsed = { nik, nama, raw_text: text };
      setHasil(parsed);

      // Simpan ke Supabase lewat API simpan saja (tanpa OCR lagi)
      await fetch("/api/ktp/save", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ nik, nama, fotoName: file.name })
      });

    }catch(err:any){
      alert("Gagal OCR: "+err.message);
    }finally{ setLoading(false); }
  };

  return (
    <div className="p-6">
      <h1 className="font-bold">Registrasi Pasien Puskesmas</h1>
      <input type="file" accept="image/*" onChange={handleUpload} />
      {preview && <img src={preview} className="mt-4 max-w-sm border" />}
      {loading && <p className="animate-pulse">Membaca KTP Tommy Faisal...</p>}
      {hasil && <pre className="mt-4 bg-gray-100 p-4 text-xs">{JSON.stringify(hasil,null,2)}</pre>}
    </div>
  );
}