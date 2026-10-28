"use client";
import { useEffect, useState } from "react";

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
  confidence?: number;
  error?: string;
};

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<KtpData | null>(null);
  const [rawOcr, setRawOcr] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (data?.nik) {
      localStorage.setItem("SIMASY_KTP_DATA", JSON.stringify(data));
    }
  }, [data]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setData(null);
    setRawOcr("");
    setErrorMsg("");
    if (f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setErrorMsg("");
    setData(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/ktp", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || "Gagal OCR");
      } else {
        setData(json);
        setRawOcr(json.raw_text || json.raw || "");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error fetch");
    } finally {
      setLoading(false);
    }
  };

  const openSimasy = () => {
    if (!data?.nik) return;
    // Simpan untuk Tampermonkey di simasy.id
    localStorage.setItem("SIMASY_KTP_DATA", JSON.stringify(data));
    const url = `https://simasy.id/u/fianggota0_u.php?nik=${encodeURIComponent(data.nik)}&autofill=1`;
    window.open(url, "_blank");
  };

  const copyJson = () => {
    if (data) {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      alert("JSON KTP dicopy!");
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 20, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold" }}>KTP - Input Simasy</h1>
      <div style={{ border: "1px solid #ccc", padding: 15, borderRadius: 8, marginTop: 15 }}>
        <input type="file" accept="image/*" onChange={handleFileChange} />
        {preview && (
          <div style={{ marginTop: 10 }}>
            <img src={preview} alt="preview" style={{ maxWidth: "100%", maxHeight: 400, borderRadius: 6, border: "1px solid #ddd" }} />
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
        {errorMsg && <p style={{ color: "red", marginTop: 10 }}>{errorMsg}</p>}
      </div>

      {data && !data.error && (
        <div style={{ marginTop: 20, border: "2px solid #0F8A5F", borderRadius: 10, padding: 15, background: "#f9fffe" }}>
          <h2 style={{ fontWeight: "bold", marginBottom: 10 }}>HASIL BACA KTP - URUTAN KTP</h2>

          <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", rowGap: 6, fontSize: 14 }}>
            <b>NIK :</b> <span>{data.nik}</span>
            <b>Nama :</b> <span>{data.nama}</span>
            <b>Tempat/Tgl Lahir :</b> <span>{data.tempat_tgl_lahir}</span>
            <b>Jenis Kelamin :</b> <span>{data.jenis_kelamin}</span>
            <b>Gol. Darah :</b> <span>{data.gol_darah}</span>
            <b>Alamat :</b> <span>{data.alamat}</span>
            <b>RT/RW :</b> <span>{data.rt_rw}</span>
            <b>Kel/Desa :</b> <span>{data.kel_desa}</span>
            <b>Kecamatan :</b> <span>{data.kecamatan}</span>
            <b>Agama :</b> <span>{data.agama}</span>
            <b>Status Perkawinan :</b> <span>{data.status_perkawinan}</span>
            <b>Pekerjaan :</b> <span>{data.pekerjaan}</span>
            <b>Kewarganegaraan :</b> <span>{data.kewarganegaraan}</span>
            <b>Berlaku Hingga :</b> <span>{data.berlaku_hingga}</span>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, background: "#e0f7ef", padding: "6px 8px", borderRadius: 6, color: "#0F6A4A" }}>
            FIX KEL/DESA v8 - Key ke-1 dari 2 | {data.kel_desa} fix | Alamat kondisi JL/KP fix
          </div>

          {/* TOMBOL HITAM - LANGSUNG DI WEBSITE, TIDAK PERLU TAMPERMONKEY */}
          <div style={{ marginTop: 15 }}>
            <button
              onClick={openSimasy}
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
                boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
              }}
            >
              🚀 BUKA SIMASY.ID + ISI NIK {data.nik}
              <br />
              <span style={{ fontWeight: "normal", fontSize: 11 }}>{data.nama} - {data.kel_desa}</span>
            </button>

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                onClick={copyJson}
                style={{
                  background: "#fff",
                  color: "#0F8A5F",
                  padding: "8px 12px",
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: "pointer",
                  border: "1px solid #0F8A5F",
                  flex: 1,
                }}
              >
                📋 Copy JSON
              </button>
              <button
                onClick={() => {
                  if (data?.raw_text) {
                    navigator.clipboard.writeText(data.raw_text);
                    alert("Raw OCR dicopy");
                  }
                }}
                style={{
                  background: "#fff",
                  color: "#555",
                  padding: "8px 12px",
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: "pointer",
                  border: "1px solid #ccc",
                  flex: 1,
                }}
              >
                📄 Copy Raw
              </button>
            </div>
          </div>

          <details style={{ marginTop: 15 }}>
            <summary style={{ cursor: "pointer", fontSize: 14 }}>▼ Lihat Raw OCR</summary>
            <pre style={{ marginTop: 8, background: "#f5f5f5", padding: 10, borderRadius: 6, fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {rawOcr}
            </pre>
          </details>
        </div>
      )}

      {data?.error && <p style={{ color: "red", marginTop: 15 }}>{data.error}</p>}
    </div>
  );
}
