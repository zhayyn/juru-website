# Juru Website

Aplikasi audit teknis situs untuk prakom. React + TypeScript, Express, pengukuran server dan saran perbaikan deterministik. **Bisa digunakan lokal; belum dipublikasikan.**

## Mulai lokal

Gunakan Node yang memenuhi Vite 8 (`^20.19.0 || >=22.12.0`). Snapshot ini diuji pada Node 26.9.0/npm 11.19.1 di macOS arm64.

```sh
npm ci
npm run dev
```

Buka <http://127.0.0.1:3000>. Tidak perlu AI atau Supabase. Default bind loopback, AI `none`, publikasi ranking cloud `false`. Jangan memakai `vite preview` sebagai layanan aplikasi: endpoint audit berjalan di Express.

Untuk menjalankan hasil build:

```sh
npm run build
NODE_ENV=production npm start
```

Jika port 3000 digunakan aplikasi lain:

```sh
HOST=127.0.0.1 PORT=3097 ALLOWED_HOSTS=127.0.0.1:3097 NODE_ENV=production npm start
```

## Cara pakai

1. Pilih kategori Website Umum atau Peradilan Agama serta MOBILE/DESKTOP.
2. Masukkan URL publik HTTP/HTTPS tanpa kredensial, query atau fragmen.
3. Jalankan pemeriksaan. Baca bukti, prioritas, tindakan dan cara verifikasi pada rekomendasi.
4. Gunakan cetak browser untuk PDF. Ranking sesi yang memenuhi syarat dapat diekspor CSV/JSON; riwayat sesi tidak bertahan setelah reload.

Skor `technical-v1` adalah rata-rata Performance, Accessibility, Best Practices dan SEO, masing-masing 25%. Skor hilang tetap `null`, bukan nol atau pengganti dari response time. Ranking mensyaratkan beranda MOBILE, target 2xx, sumber PageSpeed dan empat skor lengkap. Checklist otomatis satu halaman (`automatic-checklist-v1`) dapat menandai `Terpenuhi`/`Tidak Ditemukan` (HTTPS pada URL diperiksa) dan `Sebagian` untuk kandidat tautan atau sinyal parsial, sementara indikator lainnya tetap `Belum Diverifikasi`; checklist tidak ikut skor dan tidak memvalidasi isi, periode, atau kepatuhan resmi. Ini bukan ranking resmi, audit kepatuhan, pentest atau sertifikasi keamanan.

## Batas dan konfigurasi

- PageSpeed dapat mengembalikan HTTP 429. Laporan probe dan saran tetap tersedia, tetapi skor tidak dibuat-buat dan tidak masuk ranking. `PAGESPEED_API_KEY` opsional di server; key tidak menghapus kuota atau menjamin hasil sukses.
- `.env.example` mencantumkan konfigurasi pilot. Kunci provider/service-role tidak boleh masuk browser, `VITE_*`, URL atau Git.
- Pilot non-loopback fail-closed tanpa token, host allowlist dan target allowlist. HTTPS tetap harus disediakan hosting/reverse proxy.
- Kuota memori per proses: maksimal 2 audit berbeda bersamaan, 50 audit baru/hari UTC, 5 POST/menit/socket-IP. Cache 15 menit dan dedup permintaan identik. Restart menghapus state; bukan quota durable/multi-instance.
- Supabase/AI opsional belum diaktifkan. Migrasi hanya diuji lokal; tidak ada perubahan remote, biaya provider baru atau deployment.

## Verifikasi

Snapshot lokal terbaru (22 November 2026): 367 tes unit/integrasi/SSR, 1 pemeriksaan aset build (`test:build`), 4 tes blueprint pilot, 16 pemeriksaan browser, serta `npm audit --omit=dev` 0 temuan; snapshot 303 tes/21 runtime production-only dan 72 SQL native lokal sebelumnya dipertahankan sebagai bukti historis. Review dan remediasi patch lokal selesai/lulus tanpa deployment atau perubahan Supabase remote.

```sh
npm run lint
npm test
npm run build
npm run test:build
npm audit --omit=dev --json
npm run test:browser
```

`test:browser` memakai Chrome lokal macOS secara default; pada platform lain isi `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Tes ini mengakses example.com dan Google PageSpeed; alur ranking sukses memakai fixture berlabel, bukan skor nyata. Jangan mengulang harness SQL historis pada direktori cluster/evidence yang sama.

- [Matriks fitur, source, dan bukti verifikasi](docs/FEATURE_MATRIX.md)
- [Status akhir pengerjaan lokal dan bukti verifikasi](docs/FINAL_STATUS.md)
- [Panduan pilot dan deployment](docs/PILOT.md)
- [Status dependensi dan advisory build-time](docs/evidence/dependency-audit-status.md)
- [SQL native lokal: ACL/atomicity/concurrency](docs/evidence/sql-native-20261118T154203Z/README.md)
- Bukti browser: `docs/evidence/browser/results.json` dan screenshot/PDF di direktori yang sama.
