# Juru Website — pilot terbatas, belum dipublikasikan

## 1. Lokal tanpa akun

```sh
npm ci
npm run dev
```

Default <http://127.0.0.1:3000>. Jika port dipakai aplikasi lain, pilih port bebas dan sesuaikan `ALLOWED_HOSTS`; jangan hentikan layanan lain. Produksi lokal: `npm run build`, lalu `NODE_ENV=production npm start`.

AI default `none`, publikasi ranking cloud `false`. Rekomendasi deterministik tetap tersedia tanpa LLM. PageSpeed memerlukan jaringan/kuota Google; HTTP 429 berarti belum terukur, bukan skor gagal/sukses. `PAGESPEED_API_KEY` opsional di environment server, dikirim ke endpoint Google melalui header, tidak ke URL/browser; key tidak menjamin kuota tersedia.

## 2. Metodologi

`technical-v1`: empat kategori Lighthouse (Performance, Accessibility, Best Practices, SEO), masing-masing 25%. Ranking hanya beranda MOBILE, respons target 2xx, sumber PageSpeed dan empat skor lengkap/rentang 0–100. Satu skor hilang berarti total `null` dan tidak masuk ranking. Response time probe bukan Core Web Vitals.

Identitas `requestedUrl` dan `finalUrl` Lighthouse wajib ada serta sama persis setelah normalisasi URL dengan halaman akhir probe; scheme, hostname, path, query dan fragmen tidak dilonggarkan. `runtimeError` membatalkan semua skor walaupun empat kategori terisi. Laporan memeriksa ulang identitas sebelum menghitung total/ranking. Hasil berbeda/tidak lengkap menjadi null dengan peringatan generik, bukan dialihkan ke domain/halaman asal. Pemeriksaan ini mencegah salah atribusi hasil, **tidak mengendalikan semua navigasi perantara di browser Google** atau menjamin konten tidak berubah antara probe dan Lighthouse.

Checklist isi/dokumen tetap **Belum Diverifikasi**, tidak ikut skor. Pemeriksaan satu halaman dan heuristik HTML bukan bukti kelengkapan situs, aksesibilitas menyeluruh, audit kepatuhan resmi, pentest atau sertifikasi keamanan. Header hadir bukan bukti konfigurasi header aman. Saran AI perlu konfirmasi, tidak menentukan skor. Hasil Lighthouse dapat berbeda antarwaktu/run.

## 3. Kontrol pilot yang sudah ada

- Server mengukur dan menghitung nilai; browser hanya mengirim URL, kategori, strategi. Field skor dari browser ditolak.
- Proteksi SSRF: hostname publik saja, validasi semua IP DNS, pin transport ke IP tervalidasi, TLS tetap memeriksa hostname, validasi tiap redirect, tanpa downgrade HTTPS; query/fragmen, userinfo, IP literal, port nonstandar dan alamat internal/reserved ditolak.
- Validasi DNS awal dibatasi maksimal 10 detik; probe memiliki budget terpisah maksimal 10 detik termasuk DNS seluruh redirect/body, maksimal 3 redirect, HTML maksimal 1 MiB. Timeout validasi melepas slot API dan hasil DNS terlambat tidak melanjutkan probe. Penantian aplikasi dibatasi; ini tidak membatalkan lookup OS yang sudah berjalan.
- Cache 15 menit, single-flight, maksimum 2 audit berbeda bersamaan dan 50 audit baru/hari UTC; 5 POST/menit/socket-IP. State hanya memori satu proses: restart menghapusnya. Reverse proxy dapat membuat semua pengguna berbagi bucket; jangan mengaktifkan trust proxy sembarang atau memakai deployment multi-instance tanpa pembatas durable.
- Basic auth seluruh HTML/assets/API kecuali GET health. Username `prakom`; token acak minimal 24 karakter. Bukan akun per pengguna, tidak ada pencabutan undangan individual atau audit log identitas.
- Host allowlist pada semua rute. Target allowlist exact hostname pada initial URL dan setiap hop sebelum koneksi; alias `www`/redirect harus disetujui dan dicantumkan terpisah. Tidak ada wildcard otomatis.
- CSV menetralkan awalan formula pada teks tidak tepercaya. Perubahan skor tetap nilai numerik positif/negatif/nol tanpa apostrof atau tanda plus; byte unduhan browser diperiksa. JSON/PDF dan ranking sesi diuji terpisah; data fixture browser berlabel tidak diperlakukan sebagai audit nyata.
- Development menonaktifkan `server.ws` dan `hmr` sekaligus melalui helper yang dipakai entry Express; `hmr:false` saja tidak cukup pada Vite 8. Tidak ada listener WebSocket terpisah yang melewati gate Express. Import Vite tetap dinamis dan tidak diperlukan untuk start produksi. Ini bukan izin membuka dev server ke internet.

## 4. Rekomendasi deployment gratis — belum dieksekusi

**Mulai dengan pilot 3–5 prakom, AI mati dan tanpa ranking bersama.** Rekomendasi tetap bermanfaat meskipun PageSpeed sementara 429. Jangan mengumumkan papan peringkat sebelum ada pengukuran lengkap nyata dan persetujuan pemilik situs.

Render Free dapat dipertimbangkan untuk Node+React, bukan untuk SLA produksi: dokumentasi menyebut tidur setelah 15 menit tanpa traffic, cold start sekitar satu menit, filesystem ephemeral dan batas 750 jam gratis per workspace/bulan.[1] Supabase Free opsional untuk penyimpanan bersama; halaman harga menyebut pause setelah satu minggu inaktif dan batas dua proyek aktif.[2] Ketentuan/kuota dapat berubah; periksa kembali saat provisioning. Tidak ada janji gratis selamanya atau izin upgrade berbayar otomatis.

Saat akun/hosting telah dipilih dan publikasi disetujui:

1. Buat **Node Web Service**, bukan static-site saja. Gunakan paket repo yang sudah diverifikasi; jangan menyalakan dev server di internet.
2. Build `npm ci && npm run build`; start `NODE_ENV=production npm start`. Untuk runtime minimal, setelah build jalankan `npm prune --omit=dev --ignore-scripts` atau gunakan stage terpisah yang hanya memasang dependency produksi. Jangan prune checkout kerja yang masih dipakai QA.
3. Isi secret melalui pengaturan environment hosting, bukan Git/chat/URL. `HOST=0.0.0.0`, `PORT` mengikuti hosting, `ALLOWED_HOSTS` exact host deployment (tanpa skema/path), `PILOT_ACCESS_TOKEN` acak, `PILOT_ALLOWED_TARGETS` exact domain situs yang sudah disetujui. Startup non-loopback gagal bila salah satunya tidak diisi. Lihat `.env.example`.
4. Pertahankan `AI_PROVIDER=none` dan `RANKING_PUBLISH_ENABLED=false`. Gunakan HTTPS hosting/reverse proxy; **jangan mengirim Basic auth melalui HTTP publik**. Jangan membuka port Mac atau tunnel sebagai jalan pintas.
5. Probe GET `/api/health`; tanpa credential, `/`, asset dan API harus 401. Uji login valid tanpa menyimpan credential di bukti; host salah 403, target di luar daftar/redirect ke luar daftar ditolak, internal target ditolak. Ulangi browser mobile/desktop dan ekspor di URL staging HTTPS.
6. Pantau 429/latensi/error. Maksimal satu proses/instance selama quota masih memori; tambahkan penyimpanan quota durable, identitas pengguna, monitoring dan retensi/penghapusan sebelum perluasan publik. Jangan memakai database Render Free berumur terbatas sebagai penyimpanan utama tanpa rencana pemulihan.

Belum ada deployment, pengaturan akun, biaya baru, tunnel, atau perubahan Supabase produksi dalam pekerjaan lokal ini. Panduan adalah rekomendasi, bukan bukti URL publik sudah operasional.

## 5. Supabase: lokal lulus, remote belum

Migrasi `supabase/migrations/202611170001_trusted_ranking.sql` diuji native PostgreSQL lokal: **72/72**, mencakup anon/authenticated SELECT-only, RPC server saja, revocation PUBLIC/legacy, rollback atomik, dua race lintas PID dan burst 24 RPC dari tiga koneksi tanpa kehilangan count/history. Bukti dan batasnya: [laporan SQL native](evidence/sql-native-20261118T154203Z/README.md). Hash migrasi cocok sebelum/sesudah; cluster disposable sudah dihentikan.

Ini bukan verifikasi JWT/PostgREST, RLS/ACL Supabase terpasang, konfigurasi/versi hosting atau crash recovery. Untuk ranking bersama, perlu persetujuan perubahan staging terlebih dahulu, backup, terapkan migrasi, uji role anon melalui API nyata (mutation/RPC ditolak), lalu uji RPC server dengan data QA khusus. Jangan mempromosikan data ranking legacy. Setelah lulus baru set `SUPABASE_URL`, server-only `SUPABASE_SERVICE_ROLE_KEY`, `RANKING_PUBLISH_ENABLED=true`. Browser hanya key publik untuk SELECT. Tetapkan pemberitahuan publikasi, retensi dan kanal penghapusan sebelum menyimpan riwayat situs rekan.

## 6. AI opsional dan privasi

Mulai tanpa AI. OpenRouter adapter hanya menerima `openrouter/free` atau model `:free`, tanpa fallback berbayar, tools/search atau retry. Gemini memerlukan model eksplisit dan entry server mewajibkan `GEMINI_FREE_TIER_CONFIRMED=true`; flag ini pernyataan operator atas proyek unpaid, **bukan pemeriksaan billing otomatis**. Kunci/model/provider nyata belum diprovision dan panggilan LLM live belum dibuktikan. Jangan mengirim data pribadi/rahasia; verifikasi harga, kuota dan penggunaan data pada dokumentasi provider sebelum aktivasi. Menambah key tidak termasuk pekerjaan lokal ini.

## 7. Verifikasi yang dibedakan

- Unit/typecheck/build, browser, dependency audit, probe jaringan dan SQL adalah gate berbeda.
- Browser desktop/390px/320px, rekomendasi, riwayat, CSV/JSON byte aktual dan pembuatan PDF diuji. Sukses ranking memakai fixture **SYNTHETIC QA FIXTURE**, bukan hasil PageSpeed nyata.
- Audit `example.com` nyata menghasilkan probe berguna dan PageSpeed 429: total null, tidak masuk ranking. Jalur empat skor PageSpeed live masih perlu diuji setelah kuota tersedia; tidak diakali dengan angka rekaan.
- [Status dependensi](evidence/dependency-audit-status.md): run terbaru produksi dan seluruh dependency sama-sama 0 temuan, exit 0. Snapshot lama lima high terkait advisory withdrawn dipertahankan sebagai historis; hasil scanner bukan sertifikasi keamanan.

## Sources

[1] https://render.com/docs/free — Render Free
[2] https://supabase.com/pricing — Supabase Pricing
