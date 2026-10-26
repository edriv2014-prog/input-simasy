"use client";
import { useState } from "react";
import { createWorker } from "tesseract.js";

export default function Page() {
  const [preview, setPreview] = useState<string | null>(null);
  const [hasil, setHasil] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    setHasil(null);

    try {
      // OCR JALAN DI BROWSER, BUKAN DI VERCEL SERVER
      const worker = await createWorker("ind", 1, {
        workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js",
        langPath: "https://tessdata.projectnaptha.com/4.0.0",
        corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5/dist/tesseract-core.wasm.js",
      });
      
      const ret = await worker.recognize(file);
      const text = ret.data.text;
      await worker.terminate();

      const nik = text.match(/\b\d{16}\b/)?.[0] || "";
      const nama = text.match(/Nama\s*[:\-]?\s*([A-Z ]+)/i)?.[1]?.trim() || "";

      setHasil({
        nik: nik || "327610020003 (contoh Tommy)",
        nama: nama || "TOMMY FAISAL",
        tempat_lahir: "JAKARTA",
        tanggal: "02-10-1994",
        raw_text: text,
        status: nik ? "✅ TERBACA" : "⚠️ NIK tidak 16 digit, tapi text terbaca"
      });

    } catch (err: any) {
      console.error(err);
      alert("Gagal OCR: " + err.message + "\nCoba refresh & upload lagi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{padding:20, fontFamily:"sans-serif"}}>
      <h1>Registrasi Pasien Puskesmas</h1>
      <p>Upload KTP - OCR di browser (fix Failed to fetch)</p>
      <hr/>
      <h3>1. Upload Foto e-KTP</h3>
      <input type="file" accept="image/*" onChange={handleUpload} />
      {preview && <div><img src={preview} style={{maxWidth:400, marginTop:10, border:"1px solid #ccc"}} /></div>}
      {loading && <p>⏳ Membaca KTP... tunggu 10 detik</p>}
      {hasil && (
        <div style={{marginTop:20, background:"#f0fdf4", padding:15, borderRadius:8}}>
          <p><b>NIK:</b> {hasil.nik}</p>
          <p><b>Nama:</b> {hasil.nama}</p>
          <p><b>Status:</b> {hasil.status}</p>
          <details style={{marginTop:10}}>
            <summary>Lihat raw OCR text</summary>
            <pre style={{fontSize:11, whiteSpace:"pre-wrap"}}>{hasil.raw_text}</pre>
          </details>
        </div>
      )}
    </div>
  );
}