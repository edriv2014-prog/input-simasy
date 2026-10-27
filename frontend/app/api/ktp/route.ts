// Setelah dapat text dari OCR.space
let text = rawText.replace(/\r/g,"").replace(/\n\s*:\s*/g,": ").replace(/:\s*\n\s*/g,": ");

// NIK - 16 digit dimanapun
const nik = text.match(/\b\d{16}\b/)?.[0] || "";

// Nama - setelah Nama:
const nama = text.match(/Nama\s*:?\s*([A-Z ]{3,})/i)?.[1]?.trim().split("\n")[0].trim() || "";

// Jenis Kelamin - cari langsung, bukan lewat Alamat (kebal TLAKI)
let jk = text.match(/LAKI-LAKI|PEREMPUAN/i)?.[0] || "";
jk = jk.replace("TLAKI","LAKI");

// Alamat - WAJIB cari yang ada JL. atau KP. (bukan ambil setelah kata Alamat)
let alamat = "";
const jlMatch = text.match(/JL\.?\s*[A-Z0-9 ,\/\-]+/i) || text.match(/KP\.?\s*[A-Z0-9 ,\/\-]+/i);
if (jlMatch) {
  alamat = jlMatch[0].replace(/^:\s*/,"").trim();
}
// Kalau masih ketemu LAKI, berarti salah, cari lagi
if (/LAKI|PEREMPUAN/i.test(alamat)) {
  const allJl = [...text.matchAll(/(?:JL\.|KP\.)[^\n]+/gi)];
  alamat = allJl[0]?.[0]?.replace(/^:\s*/,"").trim() || "";
};

// Lainnya biar tidak ketuker lagi
const ttl = text.match(/JAKARTA\s*\d{2}-\d{2}-\d{4}|BOGOR,\s*\d{2}-\d{2}-\d{4}|\d{2}-\d{2}-\d{4}/i)?.[0] || "";
const rtrw = text.match(/\b\d{3}\/\d{3}\b/)?.[0] || "";
const kel = text.match(/PONDOK KELAPA|CIAMPEA/i)?.[0] || "";
const kec = text.match(/DUREN SAWIT|CIAMPEA/i)?.[0] || "";
const agama = text.match(/ISLAM|KRISTEN|KATOLIK|HINDU|BUDHA/i)?.[0] || "";
const status = text.match(/KAWIN|BELUM KAWIN/i)?.[0] || "";
const kerja = text.match(/KARYAWAN SWASTA|PELAJAR\/MAHASISWA|WIRASWASTA/i)?.[0] || "";