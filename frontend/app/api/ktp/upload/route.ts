import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createWorker } from 'tesseract.js';
export const runtime='nodejs'; export const maxDuration=60;
export async function POST(req:NextRequest){
  try{
    const fd=await req.formData(); const file=fd.get('file') as File;
    if(!file) return NextResponse.json({message:'kosong'},{status:400});
    const buf=Buffer.from(await file.arrayBuffer());
    const worker=await createWorker('ind');
    const {data:{text}}=await worker.recognize(buf); await worker.terminate();
    const nik=text.match(/\b\d{16}\b/)?.[0]||'';
    const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
    const fileName=`ktp/${nik||Date.now()}-${Date.now()}.jpg`;
    await supabase.storage.from('ktp-puskesmas').upload(fileName, buf, {contentType:file.type, upsert:true});
    const {data:urlData}=supabase.storage.from('ktp-puskesmas').getPublicUrl(fileName);
    const {data,error}=await supabase.from('data_ktp').insert([{nik: nik||'0000000000000000', nama: text.slice(0,50), foto_ktp_url: urlData.publicUrl}]).select().single();
    if(error) throw error;
    return NextResponse.json({...data, raw_text:text});
  }catch(e:any){ return NextResponse.json({message:e.message},{status:500}); }
}
