"use client";
import {useState} from "react";
export default function Page(){
  const [preview,setPreview]=useState<string|null>(null);
  const [hasil,setHasil]=useState<any>(null);
  const [loading,setLoading]=useState(false);
  const handleUpload=async(e:any)=>{
    const file=e.target.files?.[0]; if(!file) return;
    setPreview(URL.createObjectURL(file)); setLoading(true); setHasil(null);
    const fd=new FormData(); fd.append("file",file);
    try{
      // Coba pakai backend dulu, kalau gagal pakai API internal frontend
      const backendUrl=process.env.NEXT_PUBLIC_API_URL;
      let res;
      if(backendUrl){
        try{ res=await fetch(`${backendUrl}/ktp/upload`,{method:"POST",body:fd}); }catch{ res=undefined as any; }
      }
      if(!res || !res.ok){
        res=await fetch("/api/ktp/upload",{method:"POST",body:fd});
      }
      const data=await res.json();
      if(!res.ok) throw data;
      setHasil(data);
    }catch(err:any){ setHasil(err); } finally{ setLoading(false); }
  };
  return(
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-green-700 mb-4">Input SIMASY - Frontend (Root: frontend)</h1>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow">
          <input type="file" onChange={handleUpload} accept="image/*" />
          {preview && <img src={preview} className="mt-4 rounded border" />}
          {loading && <p className="mt-2 animate-pulse">Membaca KTP...</p>}
        </div>
        <div className="bg-white p-6 rounded-xl shadow">
          <pre className="text-xs whitespace-pre-wrap">{hasil? JSON.stringify(hasil,null,2): "Belum ada data"}</pre>
        </div>
      </div>
    </div>
  );
}
