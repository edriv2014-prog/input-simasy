
"use client";
import { useState } from "react";

export default function Page(){
  const [preview,setPreview]=useState("");
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(false);

  const resize = (file:File):Promise<Blob>=>{
    return new Promise(res=>{
      const img=new Image();
      img.onload=()=>{
        const c=document.createElement("canvas");
        const MAX=1200;
        let w=img.width, h=img.height;
        if(w>MAX){ h*=MAX/w; w=MAX; }
        c.width=w; c.height=h;
        c.getContext("2d")!.drawImage(img,0,0,w,h);
        c.toBlob(b=>res(b!), "image/jpeg", 0.8);
      };
      img.src=URL.createObjectURL(file);
    });
  };

  const onUpload=async(e:any)=>{
    const file=e.target.files?.[0]; if(!file) return;
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    const blob=await resize(file);
    const fd=new FormData();
    fd.append("file", new File([blob], file.name, {type:"image/jpeg"}));
    const r=await fetch("/api/ktp", {method:"POST", body:fd});
    const d=await r.json();
    setData(d);
    setLoading(false);
  };

  return(
    <div style={{background:"#f0fdf4", minHeight:"100vh", padding:20}}>
      <div style={{maxWidth:800, margin:"0 auto"}}>
        <h1 style={{textAlign:"center", color:"#0F8A5F", fontWeight:"bold", fontSize:22}}>REGISTRASI PUSKESMAS (KTP)</h1>
        <p style={{textAlign:"center", fontSize:12, color:"#666"}}>Upload KTP - Urutan sesuai KTP asli</p>

        <div style={{background:"#fff", padding:15, borderRadius:12, marginTop:15, boxShadow:"0 2px 8px rgba(0,0,0,0.1)"}}>
          <input type="file" accept="image/*" onChange={onUpload} />
          {preview && <img src={preview} style={{width:"100%", maxWidth:400, marginTop:15, borderRadius:8, border:"1px solid #ddd"}} />}
          {loading && <p style={{color:"#0F8A5F"}}>⏳ Membaca KTP...</p>}
        </div>

        {data && !data.error && (
          <div style={{background:"#fff", padding:20, borderRadius:12, marginTop:20, borderLeft:"5px solid #0F8A5F"}}>
            <h3 style={{margin:0, color:"#0F8A5F", borderBottom:"1px solid #eee", paddingBottom:8}}>HASIL BACA KTP - URUTAN KTP</h3>
            <div style={{fontFamily:"monospace", fontSize:14, lineHeight:"1.8", marginTop:10}}>
              <div><b>NIK</b> : {data.NIK}</div>
              <div><b>Nama</b> : {data.nama}</div>
              <div><b>Tempat/Tgl Lahir</b> : {data.ttl}</div>
              <div><b>Jenis Kelamin</b> : {data.jenis_kelamin}</div>
              <div><b>Gol. Darah</b> : {data.gol_darah || "-"}</div>
              <div><b>Alamat</b> : {data.alamat}</div>
              <div><b>RT/RW</b> : {data.rtrw}</div>
              <div><b>Kel/Desa</b> : {data.kel_desa}</div>
              <div><b>Kecamatan</b> : {data.kecamatan}</div>
              <div><b>Agama</b> : {data.agama || "-"}</div>
              <div><b>Status Perkawinan</b> : {data.status_kawin || "-"}</div>
              <div><b>Pekerjaan</b> : {data.pekerjaan || "-"}</div>
              <div><b>Kewarganegaraan</b> : {data.kewarganegaraan || "WNI"}</div>
              <div><b>Berlaku Hingga</b> : {data.berlaku || "SEUMUR HIDUP"}</div>
            </div>
            <div style={{marginTop:15, background:"#f0fdf4", padding:8, borderRadius:6, fontSize:11, color:"#0F8A5F"}}>
              {data.info} | Key {data.key_used}/{data.total_keys}
            </div>
            <details style={{marginTop:10}}><summary style={{fontSize:12, cursor:"pointer"}}>Lihat Raw OCR</summary><pre style={{fontSize:10, whiteSpace:"pre-wrap", background:"#f9f9f9", padding:8}}>{data.raw_text}</pre></details>
          </div>
        )}
      </div>
    </div>
  );
}
