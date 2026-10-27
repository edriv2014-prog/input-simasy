
"use client";
import { useState } from "react";
export default function Page(){
  const [preview,setPreview]=useState("");
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(false);
  const onUpload=async(e:any)=>{
    const file=e.target.files?.[0]; if(!file) return;
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    const fd=new FormData(); fd.append("file", file);
    const r=await fetch("/api/ktp",{method:"POST", body:fd});
    const j=await r.json();
    setData(j);
    setLoading(false);
  };
  return(
    <div style={{background:"#e8f5e9", minHeight:"100vh", padding:20}}>
      <div style={{maxWidth:700, margin:"0 auto"}}>
        <h2 style={{textAlign:"center", color:"#0F8A5F"}}>REGISTRASI PUSKESMAS (KTP)</h2>
        <div style={{background:"#fff", padding:15, borderRadius:12}}>
          <input type="file" accept="image/*" onChange={onUpload} />
          {preview && <img src={preview} style={{width:"100%", marginTop:10, borderRadius:8}} />}
          {loading && <p>⏳ Membaca...</p>}
        </div>
        {data && (
          <div style={{background:"#fff", padding:20, borderRadius:12, marginTop:20, borderLeft:"5px solid #0F8A5F"}}>
            <h3 style={{color:"#0F8A5F", marginTop:0}}>HASIL BACA KTP - URUTAN KTP</h3>
            {data.error ? <p style={{color:"red"}}>{data.error}</p> : (
              <div style={{fontFamily:"monospace", fontSize:14, lineHeight:"2"}}>
                <div><b>NIK</b> : {data.NIK}</div>
                <div><b>Nama</b> : {data.Nama}</div>
                <div><b>Tempat/Tgl Lahir</b> : {data["Tempat/Tgl Lahir"]}</div>
                <div><b>Jenis Kelamin</b> : {data["Jenis Kelamin"]}</div>
                <div><b>Gol. Darah</b> : {data["Gol. Darah"]}</div>
                <div><b>Alamat</b> : {data.Alamat}</div>
                <div><b>RT/RW</b> : {data["RT/RW"]}</div>
                <div><b>Kel/Desa</b> : {data["Kel/Desa"]}</div>
                <div><b>Kecamatan</b> : {data.Kecamatan}</div>
                <div><b>Agama</b> : {data.Agama}</div>
                <div><b>Status Perkawinan</b> : {data["Status Perkawinan"]}</div>
                <div><b>Pekerjaan</b> : {data.Pekerjaan}</div>
                <div><b>Kewarganegaraan</b> : {data.Kewarganegaraan}</div>
                <div><b>Berlaku Hingga</b> : {data["Berlaku Hingga"]}</div>
              </div>
            )}
            {data.raw_text && <details style={{marginTop:10}}><summary style={{fontSize:12}}>Lihat Raw OCR (cek di sini kalau NIK ada)</summary><pre style={{fontSize:10, whiteSpace:"pre-wrap", background:"#f5f5f5", padding:8}}>{data.raw_text}</pre></details>}
            {data.info && <div style={{fontSize:11, color:"#0F8A5F", marginTop:10}}>{data.info}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
