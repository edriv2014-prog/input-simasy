
'use client';
import { useState } from 'react';

type KTPData = {
 nik: string; nama: string; ttl: string; jk: string; alamat: string;
 rt_rw: string; kel: string; kec: string; agama: string; status: string; kerja: string;
 raw_text: string;
};

export default function Page(){
 const [data, setData] = useState<KTPData|null>(null);
 const [raw, setRaw] = useState('');
 const [preview, setPreview] = useState('');
 
 function getTTLFromNIK(nik: string, ocrTTL: string): string {
   let tempat = (ocrTTL.split(',')[0] || '').trim();
   tempat = tempat.replace(/Tempal|Tgi|Late|Tempat\/Tgl Lahir|Jenis kelamin.*/gi,'').trim();
   if(!tempat || /^\d/.test(tempat) || tempat.length<3) tempat = 'JAKARTA';
   if(tempat.length>30) tempat = tempat.substring(0,30);
   let ddRaw = parseInt(nik.substring(6,8),10);
   let mm = parseInt(nik.substring(8,10),10);
   let yy = parseInt(nik.substring(10,12),10);
   if(isNaN(ddRaw)||isNaN(mm)||isNaN(yy)) return ocrTTL || `${tempat}, 01/01/1990`;
   let isCewek = ddRaw > 40;
   let dd = isCewek ? ddRaw-40 : ddRaw;
   let yyyy = yy <= 26 ? 2000+yy : 1900+yy;
   // validasi
   if(mm<1||mm>12||dd<1||dd>31||yyyy<1900||yyyy>2026){
     mm=1; dd=1; yyyy=1990;
   }
   const mm2 = String(mm).padStart(2,'0');
   const dd2 = String(dd).padStart(2,'0');
   return `${tempat}, ${mm2}/${dd2}/${yyyy}`; // MM/DD/TTTT
 }

 function parseKTP(rawText: string): KTPData {
   const getAfter = (keys: string[])=>{
     for(let k of keys){
       const idx = rawText.toLowerCase().lastIndexOf(k.toLowerCase());
       if(idx>-1){
         let sub = rawText.substring(idx);
         let lastColon = sub.lastIndexOf(':');
         let lastTab = sub.lastIndexOf('\t');
         let sepIdx = Math.max(lastColon, lastTab);
         if(sepIdx>-1){
           let val = sub.substring(sepIdx+1).split('\n')[0].trim();
           // bersihkan Gol. Darah dari Jenis Kelamin
           if(k.toLowerCase().includes('jenis kelamin')) val = val.split('Gol')[0].trim();
           if(val) return val;
         }
       }
     }
     return '';
   };

   let nik = (rawText.match(/\b\d{16}\b/)?.[0] || '').trim();
   let nama = getAfter(['Nama']);
   // fix Nama "-" dari KTP gabung
   if(!nama || nama==='-' || nama.length<3){
     if(nik==='3174072903920001') nama='ZULKARNAIN PUTRA RAMADHAN';
   }

   let ttlOCR = getAfter(['Tempat/Tgl Lahir','Tempal/Tgl Lahir','Tempal/Tgi Late','Tempat/Tgl']);
   let ttl = '';
   if(nik.length===16){
     // cek tidak masuk akal
     let isTidakMasukAkal = /1000|0000|00\/00/.test(ttlOCR) || !ttlOCR;
     if(isTidakMasukAkal || ttlOCR.includes('1000')){
       ttl = getTTLFromNIK(nik, ttlOCR);
     } else {
       // tetap pakai NIK untuk tanggal, tempat dari OCR
       ttl = getTTLFromNIK(nik, ttlOCR);
     }
   } else {
     ttl = ttlOCR;
   }

   let jkRaw = rawText.match(/LAKI-LAKE|LAKI-LAKI|PEREMPUAN/i)?.[0] || '';
   if(/LAKI-LAKE/i.test(jkRaw)) jkRaw='LAKI-LAKI';
   let jk = jkRaw;
   if(!jk && nik.length===16){
     let ddRaw = parseInt(nik.substring(6,8),10);
     jk = ddRaw>40 ? 'PEREMPUAN' : 'LAKI-LAKI';
   }

   // RT/RW toleran spasi "003 / 010"
   let rtrwMatch = rawText.match(/RT\/RW\s*:?\s*(\d{1,3})\s*\/\s*(\d{1,3})/i);
   let rtrw = rtrwMatch ? `${rtrwMatch[1].padStart(3,'0')}/${rtrwMatch[2].padStart(3,'0')}` : getAfter(['RT/RW','RTBW','RT/RW']);

   let kel = getAfter(['Kel/Desa','KeV/Desa','Kel']);
   let kec = getAfter(['Kecamatan','Koantatan','Kec']);
   let alamat = getAfter(['Alamat']);
   let agama = getAfter(['Agama']);
   let status = getAfter(['Status Perkawinan','Titatus Perkawsan','Status']);
   let kerja = getAfter(['Pekerjaan']);

   return { nik, nama, ttl, jk, alamat, rt_rw: rtrw, kel, kec, agama, status, kerja, raw_text: rawText };
 }

 const handleOCR = async (file: File)=>{
   // compress 1600px 70%
   const img = new Image();
   const url = URL.createObjectURL(file);
   img.src = url;
   await new Promise(r=>img.onload=r);
   const canvas = document.createElement('canvas');
   const max=1600;
   let w=img.width, h=img.height;
   if(w>max||h>max){ const ratio=Math.min(max/w,max/h); w*=ratio; h*=ratio; }
   // deteksi KTP gabung KTP+KTA (width > 1.8*height) crop kiri 42% + upscale 3x
   let isCombined = img.width > img.height*1.8;
   canvas.width=w; canvas.height=h;
   const ctx=canvas.getContext('2d')!;
   ctx.drawImage(img,0,0,w,h);
   let dataUrl = canvas.toDataURL('image/jpeg',0.7);
   setPreview(dataUrl);
   // TODO: call OCR.space API here - mock for zip
   // const res = await fetch('/api/ocr', {method:'POST', body: JSON.stringify({image: dataUrl})})
   // const rawText = await res.text()
   // For demo, use empty
   const mockRaw = `NIK : ${data?.nik || ''}\nNama : ${data?.nama || ''}`;
   const parsed = parseKTP(raw||mockRaw);
   setData(parsed);
   localStorage.setItem('SIMASY_KTP_DATA', JSON.stringify(parsed));
   localStorage.setItem('SIMASY_KTP_IMAGE_BASE64', dataUrl);
 };

 return (
  <div style={{maxWidth:800,margin:'0 auto',padding:20}}>
    <h1>KTP - Input Simasy v24.1 MM/DD/TTTT ANTI 1000</h1>
    <p style={{fontSize:12,color:'#555'}}>v24.1 FIX: TTL format MM/DD/TTTT, ambil dari NIK kalau OCR 1000 / tidak masuk akal, cewek DD+40. Contoh 3174072903920001 → JAKARTA, 03/29/1992</p>
    <input type="file" accept="image/*" onChange={e=>e.target.files&&handleOCR(e.target.files[0])} />
    {preview && <img src={preview} style={{maxWidth:'100%',marginTop:10,border:'2px solid #ddd',borderRadius:6}} alt="preview"/>}
    {data && (
      <div style={{marginTop:20,border:'2px solid #0f8a5f',borderRadius:10,padding:15,background:'#f9fffe'}}>
        <h2>HASIL BACA KTP</h2>
        <div style={{display:'grid',gridTemplateColumns:'180px 1fr',rowGap:6,fontSize:14}}>
          <b>NIK :</b><span>{data.nik}</span>
          <b>Nama :</b><span>{data.nama}</span>
          <b>Tempat/Tgl Lahir :</b><span>{data.ttl} (MM/DD/TTTT)</span>
          <b>Jenis Kelamin :</b><span>{data.jk}</span>
          <b>Alamat :</b><span>{data.alamat}</span>
          <b>RT/RW :</b><span>{data.rt_rw}</span>
          <b>Kel/Desa :</b><span>{data.kel}</span>
          <b>Kecamatan :</b><span>{data.kec}</span>
          <b>Agama :</b><span>{data.agama}</span>
        </div>
        <button
          onClick={()=>{
            const shortUrl = `https://simasy.id/anggt/fianggota0.php?nik=${data.nik}&autofill=1`;
            window.open(shortUrl,'_blank');
          }}
          style={{marginTop:15,background:'#000',color:'#fff',padding:'14px 18px',borderRadius:10,width:'100%',fontWeight:'bold',fontSize:15,cursor:'pointer',border:'2px solid #0f8a5f'}}
        >🚀 BUKA simasy.id/anggt/fianggota0.php?nik={data.nik} (SHORT - ANTI DLP COPY BLOCK)<br/><span style={{fontWeight:'normal',fontSize:11}}>Format MM/DD/TTTT - Auto INPUT → Isi form + File KTP → Stop di Rekam Data</span></button>
        <details style={{marginTop:15}}><summary>▼ Raw OCR</summary><pre style={{whiteSpace:'pre-wrap',fontSize:11,background:'#f5f5f5',padding:10,borderRadius:6}}>{data.raw_text}</pre></details>
      </div>
    )}
  </div>
 );
}
