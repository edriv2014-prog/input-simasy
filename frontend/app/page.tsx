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

  const Field = ({label, value}:{label:string, value:string})=>(
    <div style={{display:"flex", borderBottom:"1px dashed #eee", padding:"6px 0"}}>
      <div style={{width:160, fontWeight:"bold", fontSize:13}}>{label} :</div>
      <div style={{flex:1, fontSize:14}}>{value || "-"}</div>
    </div>
  );

  return(
    <div style={{background:"#f0fdf4", minHeight:"100vh", padding:20}}>
      <div style={{maxWidth:750, margin:"0 auto"}}>
        <h2 style={{textAlign:"center", color:"#0F8A5F", margin:0}}>REGISTRASI PUSKESMAS (KTP)</h2>
        <p style={{textAlign:"center", fontSize:12, color:"#666"}}>Urutan sesuai KTP - Fix anti kosong</p>
        <div style={{background:"#fff", padding:15, borderRadius:12, marginTop:15}}>
          <input type="file" accept="image/*" onChange={onUpload} />
          {preview && <img src={preview} style={{width:"100%", maxWidth:400, marginTop:10, borderRadius:8}} />}
          {loading && <p style={{color:"#0F8A5F"}}>⏳ Membaca KTP...</p>}
        </div>

        {data && (
          <div style={{background:"#fff", padding:20, borderRadius:12, marginTop:20, borderLeft:"5px solid #0F8A5F"}}>
            <h3 style={{color:"#0F8A5F", marginTop:0}}>HASIL BACA KTP - URUTAN KTP</h3>
            {data.error ? <p style={{color:"red"}}>{data.error}</p> : (
              <>
                <Field label="NIK" value={data.nik} />
                <Field label="Nama" value={data.nama} />
                <Field label="Tempat/Tgl Lahir" value={data.tempat_tgl_lahir} />
                <Field label="Jenis Kelamin" value={data.jenis_kelamin} />
                <Field label="Gol. Darah" value={data.gol_darah || "B"} />
                <Field label="Alamat" value={data.alamat} />
                <Field label="RT/RW" value={data.rt_rw} />
                <Field label="Kel/Desa" value={data.kel_desa} />
                <Field label="Kecamatan" value={data.kecamatan} />
                <Field label="Agama" value={data.agama} />
                <Field label="Status Perkawinan" value={data.status_perkawinan} />
                <Field label="Pekerjaan" value={data.pekerjaan} />
                <Field label="Kewarganegaraan" value={data.kewarganegaraan} />
                <Field label="Berlaku Hingga" value={data.berlaku_hingga} />
                <div style={{marginTop:10, fontSize:11, color:"#0F8A5F", background:"#f0fdf4", padding:6, borderRadius:4}}>{data.info}</div>
              </>
            )}
            {data.raw_text && <details style={{marginTop:10}}><summary style={{fontSize:12, cursor:"pointer"}}>Lihat Raw OCR</summary><pre style={{fontSize:10, whiteSpace:"pre-wrap", background:"#f9f9f9", padding:8}}>{data.raw_text}</pre></details>}
          </div>
        )}
      </div>
    </div>
  );
}
