
"use client";
import { useState } from "react";

export default function Page(){
  const [preview,setPreview]=useState("");
  const [hasil,setHasil]=useState<any>(null);
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
        const ctx=c.getContext("2d")!;
        ctx.drawImage(img,0,0,w,h);
        c.toBlob(b=>res(b!), "image/jpeg", 0.8);
      };
      img.src=URL.createObjectURL(file);
    });
  };

  const onUpload=async(e:any)=>{
    const file=e.target.files?.[0]; if(!file) return;
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    setHasil(null);
    try{
      const blob=await resize(file);
      const fd=new FormData();
      fd.append("file", new File([blob], file.name, {type:"image/jpeg"}));
      const r=await fetch("/api/ktp", {method:"POST", body:fd});
      const data=await r.json();
      setHasil(data);
    }catch(err:any){ setHasil({error:err.message}); }
    setLoading(false);
  };

  return(
    <div style={{padding:20, maxWidth:900, margin:"0 auto"}}>
      <h2 style={{color:"#0F8A5F"}}>Registrasi Puskesmas - OCR.space 5 Keys</h2>
      <p style={{fontSize:12}}>Upload KTP Tommy - Hasil sama kayak getKTP.php kamu di localhost:8090</p>
      <input type="file" accept="image/*" onChange={onUpload} />
      {preview && <img src={preview} style={{maxWidth:400, marginTop:10, border:"1px solid #ccc"}} />}
      {loading && <p>⏳ Membaca KTP via OCR.space (1-2 detik)...</p>}
      {hasil && (
        <div style={{marginTop:15}}>
          {hasil.error ? <div style={{background:"#fee", padding:10}}>{hasil.error}</div> : <>
            <div style={{background:"#e6ffed", padding:10, fontSize:12}}>✅ {hasil.info}</div>
            <h4>Hasil OCR.space:</h4>
            <pre style={{background:"#f5f5f5", padding:10, whiteSpace:"pre-wrap"}}>{hasil.raw_text}</pre>
            <h4>Hasil Parsing:</h4>
            <pre style={{background:"#e0ffe0", padding:10}}>{JSON.stringify(hasil, null, 2)}</pre>
          </>}
        </div>
      )}
      <hr style={{marginTop:30}}/>
      <p style={{fontSize:11, color:"#888"}}>Set 5 key di .env: OCR_SPACE_API_KEYS=KEY1,KEY2,KEY3,KEY4,KEY5<br/>Vercel: Settings &gt; Env Variables &gt; OCR_SPACE_API_KEYS</p>
    </div>
  );
}
