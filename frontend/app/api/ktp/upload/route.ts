import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export async function POST(req:NextRequest){
  const {nik, nama} = await req.json();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const {data} = await supabase.from('data_ktp').insert([{nik, nama}]).select().single();
  return NextResponse.json(data);
}