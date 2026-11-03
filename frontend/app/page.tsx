"use client";
import { useState, useEffect } from "react";

type KtpData = {
  nik?: string;
  nama?: string;
  tempat_tgl_lahir?: string;
  jenis_kelamin?: string;
  gol_darah?: string;
  alamat?: string;
  rt_rw?: string;
  kel_desa?: string;
  kecamatan?: string;
  agama?: string;
  status_perkawinan?: string;
  pekerjaan?: string;
  kewarganegaraan?: string;
  berlaku_hingga?: string;
  raw_text?: string;
  error?: string;
};

async function compressImage(file: File): Promise<{ file: File, base64: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        const maxDim = 1600;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = (h / w) * maxDim; w = maxDim; }
          else { w = (w / h) * maxDim; h = maxDim; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve({ file, base64 }); return; }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (!blob) { resolve({ file, base64 }); return; }
          const newFile = new File([blob], file.name, { type: "image/jpeg" });
          const reader2 = new FileReader();
          reader2.onload = () => {
            const newBase64 = reader2.result as string;
            resolve({ file: newFile, base64: newBase64 });
          };
          reader2.readAsDataURL(newFile);
        }, "image/jpeg", 0.75);
      };
      img.onerror = () => resolve({ file, base64 });
      img.src = base64;
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

  useEffect(() => {
    if (data?.nik) localStorage.setItem("SIMASY_KTP_DATA", JSON.stringify(data));
  }, [data]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setData(null);
    setRawOcr("");
    setErrorMsg("");
    if (f) {
      setPreview(URL.createObjectURL(f));
      // Simpan nama file
      localStorage.setItem("SIMASY_KTP_IMAGE_NAME", f.name);
      // Baca base64 langsung untuk preview + simpan untuk Tampermonkey
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = reader.result as string;
        localStorage.setItem("SIMASY_KTP_IMAGE_BASE64", b64);
        localStorage.setItem("SIMASY_KTP_IMAGE_BASE64_RAW", b64);
      };
      reader.readAsDataURL(f);

      if (f.size > 4 * 1024 * 1024) {
        setErrorMsg(`File ${(f.size/1024/1024).toFixed(1)}MB kegedean - akan dikompres otomatis jadi ~1MB + tidak perlu upload 2x di simasy.id`);
      }
    } else {
      setPreview(null);
      localStorage.removeItem("SIMASY_KTP_IMAGE_BASE64");
      localStorage.removeItem("SIMASY_KTP_IMAGE_NAME");
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setErrorMsg("");
    setData(null);
    try {
      const { file: uploadFile, base64 } = await compressImage(file);
      
      // Simpan base64 yang sudah dikompres untuk Tampermonkey v3.1 anti 2x upload
      localStorage.setItem("SIMASY_KTP_IMAGE_BASE64", base64);
      localStorage.setItem("SIMASY_KTP_IMAGE_NAME", file.name);
      // Simpan juga di GM storage via event (Tampermonkey akan baca dari localStorage)
      
      const form = new FormData();
      form.append("file", uploadFile);
      const res = await fetch("/api/ktp", { method: "POST", body: form });
      const contentType = res.headers.get("content-type") || "";
      let json: any;
      if (contentType.includes("application/json")) {
        json = await res.json();
      } else {
        const txt = await res.text();
        if (txt.includes("Request Entity Too Large") || res.status === 413) {
          throw new Error(`File kegedean - max 4MB`);
        }
        throw new Error(txt.slice(0,300));
      }
      if (!res.ok) {
        setErrorMsg(json.error || `Gagal OCR (${res.status})`);
        if (json.raw_text) {
          setRawOcr(json.raw_text);
          setData(json);
        }
      } else {
        setData(json);
        setRawOcr(json.raw_text || "");
        if (json.error) setErrorMsg(json.error);
        // Pastikan image base64 tetap ada setelah OCR
        localStorage.setItem("SIMASY_KTP_IMAGE_BASE64", base64);
      }
    } catch (err: any) {
      if (err.message && err.message.includes("Unexpected token")) {
        setErrorMsg(`File kegedean atau server sibuk. Coba kompres foto dulu max 4MB.`);
      } else {
        setErrorMsg(err.message || "Error fetch");
      }
    } finally {
      setLoading(false);
    }
  };

  const openSimasyAnggt = () => {
    if (!data?.nik) return;
    localStorage.setItem("SIMASY_KTP_DATA", JSON.stringify(data));
    // Image base64 sudah disimpan di handleFileChange + compressImage
    const url = `https://simasy.id/anggt/index.php?nik=${encodeURIComponent(data.nik)}&autofill=1`;
    window.open(url, "_blank");
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 20, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: "bold" }}>KTP - Input Simasy v3.1 ANTI 2X UPLOAD</h1>
      <p style={{ color: "#555", fontSize: 12 }}>FIX: Upload 1x di sini → otomatis masuk ke Pilih File KTP & Foto di simasy.id/anggt/index.php (tidak perlu upload 2x) + Jenis Kelamin LAKI-LAKI fix</p>

      <div style={{ border: "1px solid #ccc", padding: 15, borderRadius: 8, marginTop: 15 }}>
        <input type="file" accept="image/*" onChange={handleFileChange} />
        {preview && (
          <div style={{ marginTop: 10 }}>
            <img src={preview} alt="preview" style={{ maxWidth: "100%", maxHeight: 380, borderRadius: 6, border: "1px solid #ddd" }} />
            {file && <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>Size: {(file.size/1024/1024).toFixed(2)}MB - akan auto-masuk ke simasy.id/anggt tanpa upload ulang</div>}
          </div>
        )}
        <button
          onClick={handleUpload}
          disabled={!file || loading}
          style={{
            marginTop: 12,
            background: "#0F8A5F",
            color: "#fff",
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            opacity: !file || loading ? 0.5 : 1,
          }}
        >
          {loading ? "Membaca KTP..." : "📷 Baca KTP"}
        </button>
        {errorMsg && (
          <div style={{ color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", padding: "8px 10px", borderRadius: 6, marginTop: 10, fontSize: 13 }}>
            ⚠️ {errorMsg}
          </div>
        )}
      </div>

      {data && data.nik && (
        <div style={{ marginTop: 20, border: "2px solid #0F8A5F", borderRadius: 10, padding: 15, background: "#f9fffe" }}>
          <h2 style={{ fontWeight: "bold", marginBottom: 10 }}>HASIL BACA KTP - URUTAN KTP</h2>
          <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", rowGap: 6, fontSize: 14 }}>
            <b>NIK :</b> <span>{data.nik}</span>
            <b>Nama :</b> <span>{data.nama || "-"}</span>
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

          <div style={{ marginTop: 8, fontSize: 12, background: "#e0f7ef", padding: "6px 8px", borderRadius: 6, color: "#0F6A4A" }}>
            ✅ Foto KTP {file?.name} sudah disimpan - akan otomatis masuk ke Pilih File KTP & Foto di simasy.id/anggt (tidak perlu upload 2x)
          </div>

          <div style={{ marginTop: 15 }}>
            <button
              onClick={openSimasyAnggt}
              style={{
                background: "#000",
                color: "#fff",
                padding: "14px 18px",
                borderRadius: 10,
                width: "100%",
                fontWeight: "bold",
                fontSize: 15,
                cursor: "pointer",
                border: "2px solid #0F8A5F",
                lineHeight: 1.3,
              }}
            >
              🚀 BUKA simasy.id/anggt/index.php + ISI NIK {data.nik} + FILE KTP AUTO
              <br />
              <span style={{ fontWeight: "normal", fontSize: 11 }}>{data.nama} - Auto INPUT → Isi form + File KTP → Stop di Rekam Data</span>
            </button>
          </div>

          <details style={{ marginTop: 15 }}>
            <summary style={{ cursor: "pointer", fontSize: 14 }}>▼ Lihat Raw OCR</summary>
            <pre style={{ marginTop: 8, background: "#f5f5f5", padding: 10, borderRadius: 6, fontSize: 11, whiteSpace: "pre-wrap" }}>{rawOcr}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
