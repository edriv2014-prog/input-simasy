import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
@Injectable() export class KtpService{
  private supabase=createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  async process(file:Express.Multer.File){
    const fileName=`ktp/${Date.now()}.jpg`;
    await this.supabase.storage.from('ktp-puskesmas').upload(fileName, file.buffer, {contentType:file.mimetype, upsert:true});
    const {data:urlData}=this.supabase.storage.from('ktp-puskesmas').getPublicUrl(fileName);
    const {data,error}=await this.supabase.from('data_ktp').insert([{nik: Date.now().toString().slice(-16), nama:'DARI BACKEND NEST', foto_ktp_url: urlData.publicUrl}]).select().single();
    if(error) throw error; return data;
  }
}
