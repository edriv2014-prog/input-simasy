"use client";
import { useState, useEffect } from "react";

type KtpData = {
  nik?: string; nama?: string; tempat_tgl_lahir?: string; jenis_kelamin?: string; gol_darah?: string;
  alamat?: string; rt_rw?: string; kel_desa?: string; kecamatan?: string; agama?: string;
  status_perkawinan?: string; pekerjaan?: string; kewarganegaraan?: string; berlaku_hingga?: string;
  raw_text?: string; error?: string;
};

function detectSplitX(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): number | null {
  const w = canvas.width; const h = canvas.height;
  if (w < h * 1.1) return null;
  if (w < 500) return null;
  let bestX = -1; let bestWhiteScore = -1;
  for (let x = Math.floor(w * 0.28); x < Math.floor(w * 0.72); x += 3) {
    let whitePixels = 0; let sampled = 0;
    for (let y = Math.floor(h * 0.05); y < Math.floor(h * 0.95); y += 5) {
      const d = ctx.getImageData(x, y, 1, 1).data;
      const brightness = (d[0] + d[1] + d[2]) / 3;
      if (brightness > 195) whitePixels++;
      sampled++;
    }
    const score = whitePixels / sampled;
    if (score > bestWhiteScore) { bestWhiteScore = score; bestX = x; }
  }
  if (bestWhiteScore > 0.60 && bestX > 0) {
    const leftW = bestX;
    if (leftW > w * 0.20 && leftW < w * 0.70) return leftW;
  }
  // Fallback kalau tidak ada celah putih jelas tapi gambar sangat lebar (gabung 2 kartu)
  if (w > h * 1.8 && w > 700) {
    return Math.floor(w * 0.42); // potong 42% kiri sebagai KTP
  }
  return null;
}

async function compressImage(file: File): Promise<{ file: File, base64: string, isGabung: boolean, originalBase64: string, cropInfo: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const originalBase64 = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        // Jangan kecilkan dulu kalau file sudah kecil 0.04MB
        const maxDim = 2000;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = (h / w) * maxDim; w = maxDim; }
          else { w = (w / h) * maxDim; h = maxDim; }
        }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve({ file, base64: originalBase64, isGabung: false, originalBase64, cropInfo: "" }); return; }
        ctx.drawImage(img, 0, 0, w, h);

        const splitX = detectSplitX(canvas, ctx);
        let isGabung = false;
        let finalCanvas = canvas;
        let cropInfo = "";

        if (splitX) {
          isGabung = true;
          const cropW = splitX;
          const cropH = h;
          // Crop kiri (KTP)
          const cropCanvas = document.createElement("canvas");
          // UPSCALE 3x biar OCR kebaca Nama, bukan 0.04MB kecil
          const scale = 3;
          cropCanvas.width = cropW * scale;
          cropCanvas.height = cropH * scale;
          const cropCtx = cropCanvas.getContext("2d")!;
          cropCtx.imageSmoothingEnabled = true;
          cropCtx.imageSmoothingQuality = 'high';
          // Putih background biar bersih
          cropCtx.fillStyle = "#ffffff";
          cropCtx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
          cropCtx.drawImage(canvas, 0, 0, cropW, cropH, 0, 0, cropW * scale, cropH * scale);
          
          finalCanvas = cropCanvas;
          cropInfo = `Gabung terdeteksi! Original ${w}x${h} -> split di x=${splitX} -> crop kiri ${cropW}x${cropH} -> upscale ${scale}x jadi ${cropCanvas.width}x${cropCanvas.height} biar OCR Nama kebaca.`;
          console.log("[v18 AUTO PISAH UPSCALE] " + cropInfo);
        } else {
          cropInfo = `KTP normal single ${w}x${h} - tidak di-crop, langsung upscale ke 1600px biar OCR tajam.`;
          // Untuk KTP normal, upscale juga kalau kecil
          if (w < 1000) {
            const scale = Math.min(3, 1200 / w);
            const upCanvas = document.createElement("canvas");
            upCanvas.width = w * scale;
            upCanvas.height = h * scale;
            const upCtx = upCanvas.getContext("2d")!;
            upCtx.imageSmoothingEnabled = true;
            upCtx.imageSmoothingQuality = 'high';
            upCtx.drawImage(canvas, 0, 0, upCanvas.width, upCanvas.height);
            finalCanvas = upCanvas;
          }
        }

        finalCanvas.toBlob((blob) => {
          if (!blob) { resolve({ file, base64: originalBase64, isGabung, originalBase64, cropInfo }); return; }
          const newFile = new File([blob], file.name.replace(/\.png$/i,".jpg"), { type: "image/jpeg" });
          const reader2 = new FileReader();
          reader2.onload = () => {
            const newBase64 = reader2.result as string;
            resolve({ file: newFile, base64: newBase64, isGabung, originalBase64, cropInfo });
          };
          reader2.readAsDataURL(newFile);
        }, "image/jpeg", 0.90); // quality 90% biar tidak 0.04MB pecah
      };
      img.onerror = () => resolve({ file, base64: originalBase64, isGabung: false, originalBase64, cropInfo: "" });
      img.src = originalBase64;
    };
    reader.readAsDataURL(file);
  });
}

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<KtpData | null>(null);
  const [rawOcr, setRawOcr] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isGabung, setIsGabung] = useState(false);
  const [autoCropInfo, setAutoCropInfo] = useState("");

  useEffect(() => { if (data?.nik) localStorage.setItem("SIMASY_KTP_DATA", JSON.stringify(data)); }, [data]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f); setData(null); setRawOcr(""); setErrorMsg(""); setIsGabung(false); setAutoCropInfo("");
    if (f) {
      setPreview(URL.createObjectURL(f));
      localStorage.setItem("SIMASY_KTP_IMAGE_NAME", f.name);
      const reader = new FileReader();
      reader.onload = () => localStorage.setItem("SIMASY_KTP_IMAGE_BASE64", reader.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
      localStorage.removeItem("SIMASY_KTP_IMAGE_BASE64");
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true); setErrorMsg(""); setData(null);
    try {
      const { file: uploadFile, base64, isGabung: detectedGabung, originalBase64, cropInfo } = await compressImage(file);
      setIsGabung(detectedGabung);
      setAutoCropInfo(cropInfo + (detectedGabung ? " ✅ Hasil crop akan di-OCR, Nama harusnya keisi, tidak '-' lagi." : " ✅ KTP normal, tidak di-crop."));
      setPreview(base64);
      localStorage.setItem("SIMASY_KTP_IMAGE_BASE64", base64);
      localStorage.setItem("SIMASY_KTP_IMAGE_NAME", uploadFile.name);
      localStorage.setItem("SIMASY_KTP_IMAGE_BASE64_ORIGINAL", originalBase64);
      
      const form = new FormData(); form.append("file", uploadFile);
      const res = await fetch("/api/ktp", { method: "POST", body: form });
      const ct = res.headers.get("content-type") || "";
      let json: any;
      if (ct.includes("application/json")) json = await res.json();
      else {
        const txt = await res.text();
        if (txt.includes("Request Entity Too Large") || res.status === 413) throw new Error("File kegedean - max 4MB");
        throw new Error(txt.slice(0,300));
      }
      if (!res.ok) {
        setErrorMsg(json.error || `Gagal OCR (${res.status})`);
        if (json.raw_text) { setRawOcr(json.raw_text); setData(json); }
      } else {
        setData(json); setRawOcr(json.raw_text || ""); if (json.error) setErrorMsg(json.error);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error fetch");
    } finally { setLoading(false); }
  };

  const openSimasyAnggt = () => {
    if (!data?.nik) return;
    localStorage.setItem("SIMASY_KTP_DATA", JSON.stringify(data));
    window.open(`https://simasy.id/anggt/index.php?nik=${encodeURIComponent(data.nik)}&autofill=1`, "_blank");
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 20, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: "bold" }}>KTP - Input Simasy v18 PISAH GABUNG UPSCALE</h1>
      <p style={{ color: "#555", fontSize: 12 }}>v18 FIX: KTP gabung KTP+KTA (0.04MB di screenshot) auto crop kiri + upscale 3x biar Nama tidak '-' lagi. KTP normal single tetap bisa.</p>

      <div style={{ border: "1px solid #ccc", padding: 15, borderRadius: 8, marginTop: 15 }}>
        <input type="file" accept="image/*" onChange={handleFileChange} />
        {preview && (
          <div style={{ marginTop: 10 }}>
            <img src={preview} alt="preview" style={{ maxWidth: "100%", maxHeight: 420, borderRadius: 6, border: `2px solid ${isGabung ? '#ffc107' : '#ddd'}` }} />
            {file && <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>Asli: {(file.size/1024).toFixed(0)}KB {isGabung ? '-> gabung, auto crop kiri + upscale 3x' : ''}</div>}
          </div>
        )}
        {autoCropInfo && (
          <div style={{ marginTop: 8, fontSize: 11, background: isGabung ? "#fff3cd" : "#e0f7ef", border: `1px solid ${isGabung ? '#ffc107' : '#0F8A5F'}`, padding: "6px 8px", borderRadius: 6, color: isGabung ? "#664d03" : "#0F6A4A", whiteSpace: "pre-wrap" }}>
            {autoCropInfo}
          </div>
        )}
        <button onClick={handleUpload} disabled={!file || loading} style={{ marginTop: 12, background: "#0F8A5F", color: "#fff", padding: "10px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: "bold", opacity: !file || loading ? 0.5 : 1 }}>
          {loading ? "Membaca KTP..." : "📷 Baca KTP"}
        </button>
        {errorMsg && <div style={{ color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", padding: "8px 10px", borderRadius: 6, marginTop: 10, fontSize: 13 }}>⚠️ {errorMsg}</div>}
      </div>

      {data && data.nik && (
        <div style={{ marginTop: 20, border: `2px solid ${data.nama === '-' || !data.nama ? '#b91c1c' : '#0F8A5F'}`, borderRadius: 10, padding: 15, background: "#f9fffe" }}>
          <h2 style={{ fontWeight: "bold", marginBottom: 10 }}>HASIL BACA KTP - URUTAN KTP {isGabung ? '(HASIL PISAH GABUNG + UPSCALE)' : ''}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", rowGap: 6, fontSize: 14 }}>
            <b>NIK :</b> <span>{data.nik}</span>
            <b>Nama :</b> <span style={{ color: !data.nama || data.nama === '-' ? 'red' : 'inherit', fontWeight: !data.nama || data.nama === '-' ? 'bold' : 'normal' }}>{data.nama || "-"}</span>
            <b>Tempat/Tgl Lahir :</b> <span>{data.tempat_tgl_lahir || "-"}</span>
            <b>Jenis Kelamin :</b> <span>{data.jenis_kelamin || "-"}</span>
            <b>Gol. Darah :</b> <span>{data.gol_darah || "-"}</span>
            <b>Alamat :</b> <span>{data.alamat || "-"}</span>
            <b>RT/RW :</b> <span>{data.rt_rw || "-"}</span>
            <b>Kel/Desa :</b> <span>{data.kel_desa || "-"}</span>
            <b>Kecamatan :</b> <span>{data.kecamatan || "-"}</span>
            <b>Agama :</b> <span>{data.agama || "-"}</span>
            <b>Status Perkawinan :</b> <span>{data.status_perkawinan || "-"}</span>
            <b>Pekerjaan :</b> <span>{data.pekerjaan || "-"}</span>
          </div>

          {(!data.nama || data.nama === '-') && (
            <div style={{ marginTop: 10, background: "#fef2f2", border: "1px solid #fecaca", padding: 8, borderRadius: 6, fontSize: 12, color: "#b91c1c" }}>
              ⚠️ Nama masih '-'? Foto KTP nya kekecilan (0.04MB di screenshot). Coba upload foto KTP asli yang lebih besar, jangan screenshot gabungan. Atau crop manual KTP nya saja sebelum upload.
            </div>
          )}

          <div style={{ marginTop: 8, fontSize: 12, background: "#e0f7ef", padding: "6px 8px", borderRadius: 6, color: "#0F6A4A" }}>
            ✅ File KTP sudah disimpan {isGabung ? '(hasil auto crop + upscale 3x dari gabungan)' : ''} - auto masuk ke simasy.id/anggt tanpa upload ulang - KTP normal & gabung bisa!
          </div>

          <div style={{ marginTop: 15 }}>
            <button onClick={openSimasyAnggt} style={{ background: "#000", color: "#fff", padding: "14px 18px", borderRadius: 10, width: "100%", fontWeight: "bold", fontSize: 15, cursor: "pointer", border: "2px solid #0F8A5F" }}>
              🚀 BUKA simasy.id/anggt/index.php + ISI NIK {data.nik} + FILE KTP AUTO
              <br /><span style={{ fontWeight: "normal", fontSize: 11 }}>{data.nama} - Auto INPUT → Isi form + File KTP → Stop di Rekam Data</span>
            </button>
          </div>
          <details style={{ marginTop: 15 }}><summary style={{ cursor: "pointer", fontSize: 14 }}>▼ Lihat Raw OCR</summary><pre style={{ marginTop: 8, background: "#f5f5f5", padding: 10, borderRadius: 6, fontSize: 11, whiteSpace: "pre-wrap" }}>{rawOcr}</pre></details>
        </div>
      )}
    </div>
  );
}
