
'use client';
import { useState } from 'react';

type KTPData = {
 nik: string; nama: string; ttl: string; jk: string; alamat: string;
 rt_rw: string; kel: string; kec: string; agama: string; status: string; kerja: string;
};

function ttlFromNIK(nik: string, tempat: string){
  tempat = tempat || 'BEKASI';
  if(!nik || nik.length!==16) return `${tempat}, 12/05/1987`;
  let ddRaw = parseInt(nik.substring(6,8),10);
  let mm = parseInt(nik.substring(8,10),10);
  let yy = parseInt(nik.substring(10,12),10);
  if(isNaN(ddRaw)) return `${tempat}, 12/05/1987`;
  let dd = ddRaw>40 ? ddRaw-40 : ddRaw;
  let yyyy = yy<=26 ? 2000+yy : 1900+yy;
  const mm2 = String(mm).padStart(2,'0');
  const dd2 = String(dd).padStart(2,'0');
  return `${tempat}, ${mm2}/${dd2}/${yyyy}`;
}

export default function Page(){
 const [preview,setPreview]=useState('');
 const [data,setData]=useState<KTPData>({
   nik:'3275020512870009', nama:'ADE MULYONO HIDAYAT', ttl:'BEKASI, 12/05/1987',
   jk:'LAKI-LAKI', alamat:'KP.TENGAH', rt_rw:'002/005', kel:'PABUARAN', kec:'KEMANG',
   agama:'ISLAM', status:'KAWIN', kerja:'KARYAWAN SWASTA'
 });

 const handleFile = (file: File)=>{
   const url=URL.createObjectURL(file);
   setPreview(url);
   // auto ambil NIK dari nama file kalau ada 16 digit
   const m=file.name.match(/\b\d{16}\b/);
   if(m){
     const nik=m[0];
     const ttl=ttlFromNIK(nik, data.ttl.split(',')[0]);
     const jk=parseInt(nik.substring(6,8),10)>40?'PEREMPUAN':'LAKI-LAKI';
     setData(d=>({...d, nik, ttl, jk}));
   }
 };

 const updateNIK = (nik: string)=>{
   const clean=nik.replace(/\D/g,'').slice(0,16);
   if(clean.length!==16){ setData(d=>({...d, nik:clean})); return; }
   const tempat=data.ttl.split(',')[0]||'BEKASI';
   const ttl=ttlFromNIK(clean, tempat);
   const jk=parseInt(clean.substring(6,8),10)>40?'PEREMPUAN':'LAKI-LAKI';
   setData(d=>({...d, nik:clean, ttl, jk}));
 };

 return (
  <div style={{maxWidth:860,margin:'0 auto',padding:16,fontFamily:'system-ui'}}>
    <h1>KTP - Input Simasy v24.4 MINIMAL PASTI MUNCUL - MM/DD/TTTT + NIK 7-8 -40 WANITA</h1>
    <p style={{fontSize:12,background:'#e8fff4',padding:10,borderRadius:8,border:'1px solid #0f8a5f'}}>
      v24.4 TANPA OCR API, TANPA Tesseract CDN - PASTI MUNCUL. Ketik NIK 16 digit → auto TTL MM/DD/TTTT pos7-8 -40 wanita.<br/>
      Contoh: 3275020512870009 → 12/05/1987 LAKI. 3275026512870009 → 65-40=25 → 12/25/1987 PEREMPUAN.
    </p>

    <input type="file" accept="image/*" onChange={e=>e.target.files&&handleFile(e.target.files[0])} style={{marginBottom:10}} />
    {preview && <img src={preview} style={{maxWidth:'100%',border:'3px solid #0f8a5f',borderRadius:10,marginBottom:12}} alt="KTP"/>}

    <div style={{display:'grid',gridTemplateColumns:'160px 1fr',gap:8,marginTop:10,border:'2px solid #0f8a5f',padding:14,borderRadius:12,background:'#fbfffe'}}>
      <b>NIK (16 digit):</b><input value={data.nik} onChange={e=>updateNIK(e.target.value)} placeholder="3275020512870009" style={{padding:8,border:'2px solid #000',borderRadius:6}}/>
      <b>Nama:</b><input value={data.nama} onChange={e=>setData({...data,nama:e.target.value.toUpperCase()})} style={{padding:8,border:'1px solid #ccc',borderRadius:6}}/>
      <b>Tempat/Tgl Lahir:</b><div style={{display:'flex',gap:6}}><input value={data.ttl.split(',')[0]||''} onChange={e=>setData({...data, ttl: ttlFromNIK(data.nik, e.target.value)})} placeholder="BEKASI" style={{padding:8,border:'1px solid #ccc',borderRadius:6,width:120}}/><span style={{padding:8,background:'#000',color:'#fff',borderRadius:6,fontWeight:'bold'}}>{data.ttl.split(',')[1]?.trim()||'12/05/1987'} (MM/DD/TTTT)</span></div>
      <b>Jenis Kelamin:</b><select value={data.jk} onChange={e=>setData({...data,jk:e.target.value})} style={{padding:8,borderRadius:6}}><option>LAKI-LAKI</option><option>PEREMPUAN</option></select>
      <b>Alamat:</b><input value={data.alamat} onChange={e=>setData({...data,alamat:e.target.value})} style={{padding:8,border:'1px solid #ccc',borderRadius:6}}/>
      <b>RT/RW:</b><input value={data.rt_rw} onChange={e=>setData({...data,rt_rw:e.target.value})} placeholder="002/005" style={{padding:8,border:'1px solid #ccc',borderRadius:6}}/>
      <b>Kel/Desa:</b><input value={data.kel} onChange={e=>setData({...data,kel:e.target.value})} style={{padding:8,border:'1px solid #ccc',borderRadius:6}}/>
      <b>Kecamatan:</b><input value={data.kec} onChange={e=>setData({...data,kec:e.target.value})} style={{padding:8,border:'1px solid #ccc',borderRadius:6}}/>
      <b>Agama:</b><input value={data.agama} onChange={e=>setData({...data,agama:e.target.value})} style={{padding:8,border:'1px solid #ccc',borderRadius:6}}/>
      <b>Status:</b><input value={data.status} onChange={e=>setData({...data,status:e.target.value})} style={{padding:8,border:'1px solid #ccc',borderRadius:6}}/>
      <b>Pekerjaan:</b><input value={data.kerja} onChange={e=>setData({...data,kerja:e.target.value})} style={{padding:8,border:'1px solid #ccc',borderRadius:6}}/>
    </div>

    <div style={{marginTop:16,padding:12,background:'#000',color:'#fff',borderRadius:10}}>
      <div style={{fontSize:12}}>HASIL MM/DD/TTTT - NIK pos 7-8 -40 wanita:</div>
      <div style={{fontWeight:'bold',marginTop:4}}>{data.nik} → {data.ttl} → {data.jk}</div>
      <button onClick={()=>{
        localStorage.setItem('SIMASY_KTP_DATA', JSON.stringify(data));
        window.open(`https://simasy.id/anggt/fianggota0.php?nik=${data.nik}&autofill=1`,'_blank');
      }} style={{marginTop:10,background:'#0f8a5f',color:'#fff',padding:'14px',width:'100%',borderRadius:8,fontWeight:'bold',border:0,cursor:'pointer',fontSize:16}}>
        🚀 BUKA simasy.id/anggt/fianggota0.php?nik={data.nik} (SHORT)
      </button>
    </div>

    <details style={{marginTop:12}}><summary>▼ Cara pakai (DLP-safe, pasti muncul)</summary><pre style={{whiteSpace:'pre-wrap',fontSize:11,background:'#f5f5f5',padding:10,borderRadius:6}}>
1. Upload KTP (preview pasti muncul)
2. Ketik NIK 16 digit di atas → TTL auto MM/DD/TTTT pos7-8 -40 wanita
   - 3275020512870009 → 05 pos7-8 → 12/05/1987 LAKI
   - 3275026512870009 → 65-40=25 → 12/25/1987 PEREMPUAN
3. Edit Nama, Alamat, RT/RW kalau perlu
4. Klik tombol hitam → buka fianggota0.php → ketik NIK manual → INPUT
5. Di fianggota1.php klik bookmark universal (SIMASY-UNIVERSAL-GENERATOR)
    </pre></details>
  </div>
 );
}
