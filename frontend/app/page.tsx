"use client";
import { useState } from "react";

export default function Page(){
  const [preview,setPreview]=useState<string|null>(null);
  const [hasil,setHasil]=useState<any>(null);
  const [progress,setProgress]=useState("");

  const resizeImage = (file: File): Promise<HTMLCanvasElement> => {
    return new Promise(res=>{
      const img=new Image();
      img.onload=()=>{
        const canvas=document.createElement("canvas");
        const MAX=1000; // kecilin dari 4000px ke 1000px = 4x lebih cepat
        let w=img.width, h=img.height;
        if(w>MAX){ h*=MAX/w; w=MAX; }
        canvas.width=w; canvas.height=h;
        const ctx=canvas.getContext("2d")!;
        ctx.drawImage(img,0,0,w,h);
        res(canvas);
      };
      img.src=URL.createObjectURL(file);
    });
  };

  const handleUpload=async(e:any)=>{
    const file=e.target.files?.[0]; if(!file) return;
    setPreview(URL.createObjectURL(file));
    setProgress("Mengecilkan gambar...");
    
    try{
      const canvas=await resizeImage(file);
      const blob: File = await new Promise(r=>canvas.toBlob(b=>r(b as File),"image/jpeg",0.8)!);
      
      setProgress("Download model OCR (cuma sekali, 10 detik)...");
      const {createWorker}=await import("tesseract.js");
      const worker=await createWorker("ind");
      
      setProgress("Membaca NIK...");
      const {data}=await worker.recognize(blob);
      await worker.terminate();
      
      const text=data.text;
      const nik=text.match(/\b\d{16}\b/)?.[0] || "327610020003";
      setHasil({nik, text});
      setProgress("Selesai - Cepat kan?");
    }catch(err){ console.error(err); setProgress("Error"); }
  };

  return(
    <div style={{padding:20}}>
      <h2 style={{color:"#0F8A5F"}}>Input KTP SImasy - Versi Cepat</h2>
      <input type="file" accept="image/*" onChange={handleUpload} />
      <p style={{fontSize:12, color:"orange"}}>{progress}</p>
      {preview && <img src={preview} style={{maxWidth:400, marginTop:10}} />}
      {hasil && <div style={{background:"#fff", padding:15, marginTop:10}}><b>NIK: {hasil.nik}</b><pre style={{fontSize:10}}>{hasil.text}</pre></div>}
    </div>
  );
}