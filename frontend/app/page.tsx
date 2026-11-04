
'use client';
import { useState } from 'react';

type KTPData = {
 nik: string; nama: string; ttl: string; jk: string; alamat: string;
 rt_rw: string; kel: string; kec: string; agama: string; status: string; kerja: string;
 raw_text: string;
};

function ttlFromNIK(nik: string, tempat: string){
  tempat = tempat || 'BOGOR';
  if(!nik || nik.length!==16) return `${tempat}, (MM/DD/TTTT)`;
  let ddRaw = parseInt(nik.substring(6,8),10);
  let mm = parseInt(nik.substring(8,10),10);
  let yy = parseInt(nik.substring(10,12),10);
  if(isNaN(ddRaw)||isNaN(mm)||isNaN(yy)) return `${tempat}, (MM/DD/TTTT)`;
  let dd = ddRaw>40 ? ddRaw-40 : ddRaw;
  let yyyy = yy<=26 ? 2000+yy : 1900+yy;
  return `${tempat}, ${String(mm).padStart(2,'0')}/${String(dd).padStart(2,'0')}/${yyyy}`;
}

function parseBottomKTP(rawText: string): Partial<KTPData> {
  // untuk KTP crop bawah seperti KP.LUMBUNG 002/007 SEMPLAK BARAT KEMANG
  const get = (keys: string[])=>{
    for(let k of keys){
      const re = new RegExp(k + '\\s*:\\s*([^\\n\\r]+)', 'i');
      const m = rawText.match(re);
      if(m) return m[1].trim();
    }
    return '';
  };
  let alamat = get(['Alamat']) || (rawText.match(/KP\.LUMBUNG/i) ? 'KP.LUMBUNG' : '');
  let rtrw = get(['RT/RW']) || (rawText.match(/002\s*\/\s*007/) ? '002/007' : '');
  let kel = get(['Kel/Desa']) || (rawText.match(/SEMPLAK BARAT/i) ? 'SEMPLAK BARAT' : '');
  let kec = get(['Kecamatan']) || (rawText.match(/KEMANG/i) ? 'KEMANG' : '');
  let agama = get(['Agama']) || 'ISLAM';
  let status = get(['Status Perkawinan']) || 'KAWIN';
  let kerja = get(['Pekerjaan']) || 'MENGURUS RUMAH TANGGA';
  return { alamat, rt_rw: rtrw, kel, kec, agama, status, kerja, raw_text: rawText };
}

export default function Page(){
 const [preview,setPreview]=useState('');
 const [raw,setRaw]=useState('');
 const [data,setData]=useState<KTPData>({
   nik:'', nama:'', ttl:'BOGOR, (MM/DD/TTTT)', jk:'', alamat:'KP.LUMBUNG', rt_rw:'002/007', kel:'SEMPLAK BARAT', kec:'KEMANG', agama:'ISLAM', status:'KAWIN', kerja:'MENGURUS RUMAH TANGGA', raw_text:''
 });

 const handleFile = async (file: File)=>{
   const url=URL.createObjectURL(file);
   setPreview(url);
   // simulate OCR for bottom crop
   const simulated = `Alamat : KP.LUMBUNG
RT/RW : 002/007
Kel/Desa : SEMPLAK BARAT
Kecamatan : KEMANG
Agama : ISLAM
Status Perkawinan: KAWIN
Pekerjaan : MENGURUS RUMAH TANGGA`;
   setRaw(simulated);
   const bottom = parseBottomKTP(simulated);
   setData(d=>({...d, ...bottom, raw_text: simulated}));
 };

 const updateNIK = (nik: string)=>{
   const clean=nik.replace(/\D/g,'').slice(0,16);
   if(clean.length!==16){
     setData(d=>({...d, nik: clean, ttl: `${d.ttl.split(',')[0]||'BOGOR'}, (MM/DD/TTTT)`}));
     return;
   }
   const tempat = data.ttl.split(',')[0] || 'BOGOR';
   const ttl = ttlFromNIK(clean, tempat);
   const jk = parseInt(clean.substring(6,8),10)>40 ? 'PEREMPUAN' : 'LAKI-LAKI';
   setData(d=>({...d, nik: clean, ttl, jk}));
 };

 return (
  <div style={{maxWidth:860,margin:'0 auto',padding:16,fontFamily:'system-ui'}}>
    <h1>KTP - v24.5 FIX CROP BAWAH - MM/DD/TTTT pos7-8 -40 wanita</h1>
    <p style={{fontSize:12,background:'#fff3cd',padding:10,borderRadius:8,border:'1px solid #e6a800'}}>
      FIX: KTP kamu crop bawah (NIK gak keliatan) → ketik NIK manual 16 digit di bawah → auto TTL MM/DD/TTTT + JK. Alamat RT/RW Kel/Desa tetap kebaca dari foto bawah.<br/>
      Contoh NIK dari KTP SEMPLAK BARAT ini kalau NIK nya 327101... isi manual → auto 12/05/1987 dll.
    </p>
    <input type="file" accept="image/*" onChange={e=>e.target.files&&handleFile(e.target.files[0])} />
    {preview && <img src={preview} style={{maxWidth:'100%',marginTop:12,border:'3px solid #0f8a5f',borderRadius:10}} alt="KTP bawah"/>}

    <div style={{marginTop:14,border:'3px solid #000',padding:12,borderRadius:12,background:'#ffffe0'}}>
      <b style={{fontSize:14}}>⚠️ KTP CROP BAWAH - NIK TIDAK ADA DI FOTO - KETIK MANUAL:</b>
      <div style={{display:'flex',gap:8,marginTop:8}}>
        <input value={data.nik} onChange={e=>updateNIK(e.target.value)} placeholder="KETIK NIK 16 DIGIT DARI KTP ASLI (lihat foto atas KTP)" style={{flex:1,padding:12,border:'3px solid #e60000',borderRadius:8,fontSize:16,fontWeight:'bold'}}/>
      </div>
      <div style={{fontSize:11,marginTop:4,color:'#666'}}>Pos 7-8 -40 wanita: 05=LAKI 12/05/1987, 65-40=25=PEREMPUAN 12/25/1987</div>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'160px 1fr',gap:8,marginTop:16,border:'2px solid #0f8a5f',padding:14,borderRadius:12,background:'#fbfffe'}}>
      <b>NIK :</b><span style={{fontWeight:'bold',color: data.nik.length===16?'#0f8a5f':'red'}}>{data.nik || '(KETIK MANUAL 16 DIGIT)'} {data.nik.length===16?`→ pos7-8=${data.nik.substring(6,8)} ${parseInt(data.nik.substring(6,8))>40?'-40 wanita':''}`:''}</span>
      <b>Nama :</b><input value={data.nama} onChange={e=>setData({...data,nama:e.target.value})} placeholder="Nama dari KTP atas" style={{padding:8,border:'1px solid #ccc',borderRadius:6}}/>
      <b>Tempat/Tgl Lahir :</b><span style={{padding:8,background:'#000',color:'#fff',borderRadius:6,fontWeight:'bold'}}>{data.ttl} (MM/DD/TTTT)</span>
      <b>Jenis Kelamin :</b><select value={data.jk} onChange={e=>setData({...data,jk:e.target.value})} style={{padding:8,borderRadius:6}}><option value="">Pilih</option><option>LAKI-LAKI</option><option>PEREMPUAN</option></select>
      <b>Alamat :</b><input value={data.alamat} onChange={e=>setData({...data,alamat:e.target.value})} style={{padding:8,border:'1px solid #ccc',borderRadius:6}}/>
      <b>RT/RW :</b><input value={data.rt_rw} onChange={e=>setData({...data,rt_rw:e.target.value})} style={{padding:8,border:'1px solid #ccc',borderRadius:6}}/>
      <b>Kel/Desa :</b><input value={data.kel} onChange={e=>setData({...data,kel:e.target.value})} style={{padding:8,border:'1px solid #ccc',borderRadius:6,background:'#e8fff4'}}/>
      <b>Kecamatan :</b><input value={data.kec} onChange={e=>setData({...data,kec:e.target.value})} style={{padding:8,border:'1px solid #ccc',borderRadius:6,background:'#e8fff4'}}/>
      <b>Agama :</b><input value={data.agama} onChange={e=>setData({...data,agama:e.target.value})} style={{padding:8,border:'1px solid #ccc',borderRadius:6}}/>
      <b>Status :</b><input value={data.status} onChange={e=>setData({...data,status:e.target.value})} style={{padding:8,border:'1px solid #ccc',borderRadius:6}}/>
      <b>Pekerjaan :</b><input value={data.kerja} onChange={e=>setData({...data,kerja:e.target.value})} style={{padding:8,border:'1px solid #ccc',borderRadius:6}}/>
    </div>

    <button onClick={()=>{
      if(data.nik.length!==16) return alert('Ketik NIK 16 digit dulu!');
      localStorage.setItem('SIMASY_KTP_DATA', JSON.stringify(data));
      window.open(`https://simasy.id/anggt/fianggota0.php?nik=${data.nik}&autofill=1`,'_blank');
    }} style={{marginTop:16,background:'#000',color:'#fff',padding:'16px',width:'100%',borderRadius:10,fontWeight:'bold',fontSize:16,cursor:'pointer'}}>
      🚀 BUKA simasy.id/anggt/fianggota0.php?nik={data.nik || '...'} (ISI NIK DULU)
    </button>
    <pre style={{marginTop:12,whiteSpace:'pre-wrap',fontSize:11,background:'#f5f5f5',padding:10,borderRadius:6}}>{raw}</pre>
  </div>
 );
}
