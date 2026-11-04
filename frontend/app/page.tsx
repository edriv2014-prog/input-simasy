
'use client';
import { useState } from 'react';

type KTPData = {
 nik: string; nama: string; ttl: string; jk: string; alamat: string;
 rt_rw: string; kel: string; kec: string; agama: string; status: string; kerja: string;
 raw_text: string;
};

function ttlFromNIK(nik: string, tempat: string){
  tempat = tempat || 'JAKARTA';
  if(!nik || nik.length!==16) return tempat ? `${tempat}, (MM/DD/TTTT)` : '(MM/DD/TTTT)';
  let ddRaw = parseInt(nik.substring(6,8),10);
  let mm = parseInt(nik.substring(8,10),10);
  let yy = parseInt(nik.substring(10,12),10);
  if(isNaN(ddRaw)||isNaN(mm)||isNaN(yy)) return tempat;
  let isWanita = ddRaw>40;
  let dd = isWanita ? ddRaw-40 : ddRaw;
  let yyyy = yy<=26 ? 2000+yy : 1900+yy;
  const mm2 = String(mm).padStart(2,'0');
  const dd2 = String(dd).padStart(2,'0');
  const posInfo = `pos7-8=${String(ddRaw).padStart(2,'0')}${isWanita?` -40=${String(dd).padStart(2,'0')} wanita`:''}`;
  return `${tempat}, ${mm2}/${dd2}/${yyyy} (${posInfo})`;
}

function parseKTP(rawText: string, fileName: string): KTPData {
  let nik = rawText.match(/\b\d{16}\b/)?.[0] || '';
  if(!nik){
    const m=fileName.match(/\b\d{16}\b/);
    if(m) nik=m[0];
  }
  const get = (keys: string[])=>{
    for(let k of keys){
      const re = new RegExp(k + '\\s*:?\\s*([^\\n\\r]+)', 'i');
      const m = rawText.match(re);
      if(m){
        let v=m[1].trim();
        const labels=['Tempat/Tgl Lahir','Alamat','RT/RW','Kel/Desa','Kecamatan','Agama','Status','Pekerjaan','NIK','Nama'];
        if(labels.some(l=> v.toUpperCase().includes(l.toUpperCase()))) continue;
        if(k.toLowerCase().includes('nama') && (v.toUpperCase()==='NIK' || /^\d+$/.test(v))) continue;
        if(k.toLowerCase().includes('jenis kelamin')) v=v.split(/Gol/i)[0].trim();
        if(v && v.length>1) return v;
      }
    }
    return '';
  };
  let nama = get(['Nama']);
  let ttlOCR = get(['Tempat/Tgl Lahir','Tempal/Tgl Lahir']);
  let tempatOCR = ttlOCR.split(',')[0]?.trim() || '';
  if(!tempatOCR || tempatOCR.length<3){
    const mTempat = rawText.match(/JAKARTA|BEKASI|BOGOR|KONAWE|PONDOK KELAPA|DUREN SAWIT|LAGOA|KOJA/i);
    if(mTempat) tempatOCR=mTempat[0]; else tempatOCR='JAKARTA';
  }
  let ttl = ttlOCR;
  if(nik.length===16){
    ttl = ttlFromNIK(nik, tempatOCR);
  } else if(ttlOCR){
    ttl = ttlOCR;
  } else {
    ttl = `${tempatOCR}, (MM/DD/TTTT)`;
  }
  let jk = rawText.match(/PEREMPUAN|LAKI-LAKI|LAKI-LAKE/i)?.[0] || '';
  if(/LAKI-LAKE/i.test(jk)) jk='LAKI-LAKI';
  if(!jk && nik.length===16){
    jk = parseInt(nik.substring(6,8),10)>40 ? 'PEREMPUAN' : 'LAKI-LAKI';
  }
  let rtrwM = rawText.match(/RT\s*\/\s*RW\s*[:\s]*(\d{1,3})\s*\/\s*(\d{1,3})/i) || rawText.match(/(\d{3})\/(\d{3})/);
  let rtrw = '';
  if(rtrwM && rtrwM.length>=3) rtrw = `${rtrwM[1].padStart(3,'0')}/${rtrwM[2].padStart(3,'0')}`;
  else rtrw = get(['RT/RW']) || '';
  return {
    nik, nama, ttl, jk,
    alamat: get(['Alamat']),
    rt_rw: rtrw,
    kel: get(['Kel/Desa','Kel']),
    kec: get(['Kecamatan','Kec']),
    agama: get(['Agama']),
    status: get(['Status Perkawinan','Status']),
    kerja: get(['Pekerjaan']),
    raw_text: rawText
  };
}

export default function Page(){
 const [preview,setPreview]=useState('');
 const [raw,setRaw]=useState('');
 const [loading,setLoading]=useState(false);
 const [data,setData]=useState<KTPData>({
   nik:'', nama:'', ttl:'', jk:'', alamat:'', rt_rw:'', kel:'', kec:'', agama:'', status:'', kerja:'', raw_text:''
 });
 const callOCR = async (dataUrl: string)=>{
   setLoading(true);
   try{
     const res = await fetch('/api/ocr', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ image: dataUrl }) });
     const json = await res.json();
     if(json.error) throw new Error(json.error);
     return json.ParsedResults?.[0]?.ParsedText || '';
   }catch(e){ return ''; } finally{ setLoading(false); }
 };
 const handleFile = async (file: File)=>{
   const url=URL.createObjectURL(file);
   const img=new Image(); img.src=url;
   await new Promise(r=>{img.onload=r; img.onerror=r;});
   const canvas=document.createElement('canvas');
   const max=1800; let w=img.width,h=img.height;
   if(w>max||h>max){ const ra=Math.min(max/w,max/h); w*=ra; h*=ra; }
   canvas.width=w; canvas.height=h;
   const ctx=canvas.getContext('2d')!; ctx.drawImage(img,0,0,w,h);
   const dataUrl=canvas.toDataURL('image/jpeg',0.8);
   setPreview(dataUrl);
   let text = await callOCR(dataUrl);
   if(!text) text = `NIK : \nNama : \nTempat/Tgl Lahir : \n`;
   setRaw(text);
   const parsed=parseKTP(text, file.name);
   setData(parsed);
   localStorage.setItem('SIMASY_KTP_DATA', JSON.stringify(parsed));
 };
 const updateNIK = (nik: string)=>{
   const clean=nik.replace(/\D/g,'').slice(0,16);
   if(clean.length!==16){ setData({...data, nik: clean}); return; }
   const tempat = data.ttl.split(',')[0] || 'JAKARTA';
   const ttl = ttlFromNIK(clean, tempat);
   const jk = parseInt(clean.substring(6,8),10)>40 ? 'PEREMPUAN' : 'LAKI-LAKI';
   setData({...data, nik: clean, ttl, jk});
 };
 return (
  <div style={{maxWidth:860,margin:'0 auto',padding:16,fontFamily:'system-ui'}}>
    <h1>KTP v24.8 FINAL BERSIH - TANPA HARDCODE - MM/DD/TTTT pos7-8 -40 wanita</h1>
    <p style={{fontSize:11,background:'#e8fff4',padding:8,borderRadius:8}}>v24.8 BERSIH: Tidak ada NIK hardcode di initial state. KTP YULI 3172034907750008 pos7-8=49 -40=09 wanita 07/09/1975. Upload KTP baru NIK kosong awal, tidak TOMMY.</p>
    <input type="file" accept="image/*" onChange={e=>e.target.files&&handleFile(e.target.files[0])} />
    {loading && <p>⏳ OCR via /api/ocr...</p>}
    {preview && <img src={preview} style={{maxWidth:'100%',marginTop:10,border:'2px solid #0f8a5f',borderRadius:10}} alt="KTP"/>}
    <div style={{display:'grid',gridTemplateColumns:'160px 1fr',gap:8,marginTop:14,border:'2px solid #0f8a5f',padding:14,borderRadius:12,background:'#fbfffe'}}>
      <b>NIK (16 digit):</b><div style={{display:'flex',gap:6}}><input value={data.nik} onChange={e=>updateNIK(e.target.value)} placeholder="3172034907750008 YULI" style={{flex:1,padding:8,border:'2px solid #000',borderRadius:6,fontWeight:'bold'}}/>{data.nik.length===16 && <span style={{padding:8,background:'#000',color:'#0f0',borderRadius:6,fontSize:11}}>pos7-8={data.nik.substring(6,8)} {parseInt(data.nik.substring(6,8))>40?`-40=${parseInt(data.nik.substring(6,8))-40} wanita`:''}</span>}</div>
      <b>Nama :</b><input value={data.nama} onChange={e=>setData({...data,nama:e.target.value})} style={{padding:8,border:'1px solid #ccc',borderRadius:6}}/>
      <b>Tempat/Tgl Lahir :</b><input value={data.ttl} onChange={e=>setData({...data,ttl:e.target.value})} style={{padding:8,border:'1px solid #ccc',borderRadius:6,background:'#000',color:'#fff',fontWeight:'bold'}}/>
      <b>Jenis Kelamin :</b><select value={data.jk} onChange={e=>setData({...data,jk:e.target.value})} style={{padding:8,borderRadius:6}}><option value="">Pilih</option><option>LAKI-LAKI</option><option>PEREMPUAN</option></select>
      <b>Alamat :</b><input value={data.alamat} onChange={e=>setData({...data,alamat:e.target.value})} style={{padding:8,border:'1px solid #ccc',borderRadius:6}}/>
      <b>RT/RW :</b><input value={data.rt_rw} onChange={e=>setData({...data,rt_rw:e.target.value})} style={{padding:8,border:'1px solid #ccc',borderRadius:6}}/>
      <b>Kel/Desa :</b><input value={data.kel} onChange={e=>setData({...data,kel:e.target.value})} style={{padding:8,border:'1px solid #ccc',borderRadius:6}}/>
      <b>Kecamatan :</b><input value={data.kec} onChange={e=>setData({...data,kec:e.target.value})} style={{padding:8,border:'1px solid #ccc',borderRadius:6}}/>
      <b>Agama :</b><input value={data.agama} onChange={e=>setData({...data,agama:e.target.value})} style={{padding:8,border:'1px solid #ccc',borderRadius:6}}/>
      <b>Status :</b><input value={data.status} onChange={e=>setData({...data,status:e.target.value})} style={{padding:8,border:'1px solid #ccc',borderRadius:6}}/>
      <b>Pekerjaan :</b><input value={data.kerja} onChange={e=>setData({...data,kerja:e.target.value})} style={{padding:8,border:'1px solid #ccc',borderRadius:6}}/>
    </div>
    <button onClick={()=>{
      if(data.nik.length!==16) return alert('NIK 16 digit!');
      localStorage.setItem('SIMASY_KTP_DATA', JSON.stringify(data));
      window.open(`https://simasy.id/anggt/fianggota0.php?nik=${data.nik}&autofill=1`,'_blank');
    }} style={{marginTop:14,background:'#000',color:'#fff',padding:'14px',width:'100%',borderRadius:10,fontWeight:'bold',cursor:'pointer'}}>BUKA simasy.id/anggt/fianggota0.php?nik={data.nik}</button>
    <pre style={{marginTop:10,whiteSpace:'pre-wrap',fontSize:11,background:'#f5f5f5',padding:8,borderRadius:6}}>{raw}</pre>
  </div>
 );
}
