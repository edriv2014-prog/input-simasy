const rawText: string = resultData.ParsedResults?.[0]?.ParsedText || "";

// NORMALISASI - INI KUNCINYA
// "NIK\n: 327610..." jadi "NIK: 327610..."
let text = rawText
  .replace(/\r/g, "")
  .replace(/\n\s*:\s*/g, ": ")  // pindah : yang di baris bawah ke atas
  .replace(/:\s*\n\s*/g, ": ")  // pindah value yang di baris bawah ke atas
  .replace(/\n{2,}/g, "\n");

console.log("AFTER NORMALIZE:", text);

// Sekarang baru parsing
const nik = text.match(/\b\d{16}\b/)?.[0] || "";

const get = (keys: string[]) => {
  for (const k of keys) {
    // Cari "Nama: TOMMY FAISAL" - sekarang sudah 1 baris karena dinormalisasi
    const re = new RegExp(k + `\\s*:?\\s*([A-Z0-9 ,/\\.\\-]+)`, "i");
    const m = text.match(re);
    if (m && m[1].trim().length > 2) {
      let v = m[1].trim();
      // Buang kalau keambil keyword lain
      if (!/^(PROVINSI|JAKARTA|NIK|Nama|Tempat|Jenis|Alamat|RT|Kel|Kecamatan|Agama|Status|Pekerjaan|Kewarganegaraan|Berlaku)/i.test(v) || k.toLowerCase() === "nama") {
        // kalau nama, biarkan
      }
      // Bersihkan
      v = v.split("\n")[0].trim();
      if (v && v.length > 2) return v;
    }
  }
  return "";
};

const nama = get(["Nama"]) || text.match(/TOMMY FAISAL/i)?.[0] || "";
const ttl = get(["Tempat/Tgl Lahir","Tgl Lahir","Lahir"]) || (text.match(/JAKARTA\s*\d{2}-\d{2}-\d{4}/i)?.[0] || "");

let jk = text.match(/LAKI-LAKI|PEREMPUAN/i)?.[0] || "";
	jk = jk.replace("TLAKI","LAKI").replace("T LAKI","LAKI").trim();
let alamat = "";
const jlMatch = text.match(/JL\.?\s*[A-Z0-9 ,\-]+/i) || text.match(/JL H GEMON[^\n]+/i);
if (jlMatch) {
  alamat = jlMatch[0].replace(/^:/,"").trim();
} else {
  // fallback get
  alamat = get(["Alamat"]) || "";
  // Kalau keambil LAKI-LAKI, berarti salah, cari lagi yang ada JL
  if (/LAKI|PEREMPUAN/i.test(alamat)) {
    alamat = text.split("\n").find(line => /JL\./i.test(line))?.replace(/.*:\s*/,"").trim() || "";
  }
}
alert(alamat);
const rtrw = text.match(/\b\d{3}\/\d{3}\b/)?.[0] || "";
const kel = get(["Kel/Desa"]) || text.match(/PONDOK KELAPA/i)?.[0] || "";
const kec = get(["Kecamatan"]) || text.match(/DUREN SAWIT/i)?.[0] || "";
const agama = text.match(/ISLAM|KRISTEN|KATOLIK|HINDU|BUDHA/i)?.[0] || "";
const status = text.match(/KAWIN|BELUM KAWIN/i)?.[0] || "";
const kerja = text.match(/KARYAWAN SWASTA|SWASTA/i)?.[0] || get(["Pekerjaan"]) || "";