# Juru Website — checklist otomatis, penawaran bantuan, dan domain

## Tujuan dan batas
Surface **Operate / Inspect**: formulir ringkas → hasil terukur → prioritas → bukti checklist → PDF. Bukan landing page pemasaran. Mempertahankan fitur lokal yang sudah berjalan, sumber skor, batas SSRF dan perubahan existing. Parent menjadi satu-satunya writer repo; tiga worker terpisah menangani staging engine/storage, diagnosis situs, dan riset domain/produk.

## Kontrak produk
- Deskripsi tambahan tampil saat hover, fokus keyboard atau ketuk; dapat ditutup Escape. Jangan menyembunyikan status error, sumber pengukuran, batas audit satu halaman, status penyimpanan atau penafian bukan audit resmi. Laporan PDF mempertahankan keterangan penting.
- Prioritas tinggi/menengah/rendah memakai warna **dan teks**, tanpa fear marketing. Ajakan bantuan berupa tautan `wa.me/6281317361689` dan draft pesan kontekstual setelah klik pengguna, bukan pengiriman otomatis. Jangan membuka WA saat hover atau memuat SDK/tracker WhatsApp.
- Checklist dua katalog menggunakan aturan deterministik berversi dari HTML/header/Lighthouse yang dikumpulkan server. Tautan kandidat dokumen hanya bukti parsial; tidak memvalidasi isi/periode/keaslian dokumen. Tidak teramati pada satu halaman bukan berarti dokumen tidak ada. Keterpenuhan kepatuhan resmi dan UX subjektif tetap perlu pemeriksa manusia. Tidak ada token AI diperlukan untuk skor/checklist/rekomendasi aturan.
- Total teknis tetap rata-rata empat kategori Lighthouse, dengan identitas requested/final URL dan provenance utuh. Checklist tidak mengubah ranking atau formula teknis. Setiap item menyimpan status, cara pemeriksaan, catatan dan bukti; jangan mengisi skor manual yang tidak terukur.
- Penyimpanan SQLite server menyimpan laporan dan checklist, tanpa HTML mentah/credential; prepared SQL, retensi/jumlah dibatasi, direktori privat. Kegagalan simpan terlihat namun audit tetap berguna. Database tidak disajikan static. Riwayat baca ulang hanya loopback tepercaya; jangan mengekspos daftar publik tanpa identitas/otorisasi.
- AI opsional tetap default none; permintaan audit browser tetap hanya URL/kategori/strategi. Publikasi ranking tetap off.

## Publikasi
Rekomendasi `website.juru.ai.id`, agar aplikasi independen dari situs utama. Periksa hosting/Node/persistent disk/backup/kuota dan DNS authoritative setelah login operator. Tidak menambah kartu/paket/biaya, mengganti apex/nameserver/MX, atau membuka tunnel Mac. Lighthouse lokal tetap loopback; hosted tidak boleh memakai skor lokal seolah-olah PageSpeed. Tidak mengklaim domain live sebelum DNS/TLS/API/aset/control-abuse nyata diterima.

## Acceptance
1. Regresi RED→GREEN fitur baru, lint, suite penuh, build + build-output.
2. Browser mobile320/390 dan desktop1440; hover/fokus/ketuk/Escape, warna + label, CTA WA benar tanpa auto-navigation, tidak ada page error/overflow, anchor dan print dark tetap jelas.
3. Jalur audit nyata → checklist otomatis bersumber → simpan SQLite → tutup/buka ulang store/proses → hasil sama; kegagalan DB tidak mengarang sukses.
4. Diagnosis PA Semarang memisahkan waktu/strategi lab, aset aktual dan estimasi peluang; tidak mengubah WordPress produksi.
5. Snapshot hash sebelum final gates, cocok sesudah; review statis independen tidak menggantikan runtime.
6. Monetisasi adalah hipotesis harga dan margin, bukan pendapatan nyata, jaminan ranking/skor/kepatuhan atau janji melunasi Rp400 juta.
