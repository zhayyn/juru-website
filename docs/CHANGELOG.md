# Changelog lokal

## 2026-11-18 — pengerjaan lokal dan persiapan pilot

- Memindahkan kepercayaan audit/skor ke server; browser hanya mengirim URL, kategori dan strategi. technical-v1 memakai empat kategori Lighthouse masing-masing 25%; data hilang tetap null dan ranking tidak memuat skor pengganti.
- Menambah rekomendasi deterministik berisi bukti, prioritas, tindakan dan cara verifikasi; AI tetap opsional, tidak ikut skor, serta default mati.
- Mengeraskan probe URL (SSRF, pinning DNS, redirect, deadline/ukuran body), pilot Basic auth/host/target allowlist, cache/single-flight, batas concurrency dan quota memori.
- Membatasi browser Supabase ke SELECT, menulis migration RPC server-only dan membuktikan ACL/rollback/race SQL native lokal, tanpa perubahan database remote.
- Memperbaiki mobile overflow/readability, tabel rekomendasi scroll lokal, PDF, ranking/riwayat sesi dan ekspor byte aktual. Menetralkan teks berpotensi formula pada CSV.
- Mengaktifkan opsional PageSpeed API key server-side melalui header; HTTP 429 tetap ditampilkan jujur sebagai belum terukur.
- Menaikkan dependency runtime/build, menghapus SDK AI yang tidak diperlukan dan memisahkan audit production 0 dari warning build-time npm. Membatasi pemindaian kelas Tailwind ke source agar HTML bukti pihak ketiga tidak menyuntikkan kelas/aset CSS ke build.
- Memverifikasi instalasi dependency produksi saja di scratch baru; 21 pemeriksaan runtime lulus, tidak membutuhkan Vite/Playwright/picomatch pada runtime.
- Menutup gap deadline pada validasi DNS awal melalui RED→GREEN; timeout mengembalikan error generik, melepas slot API, dan hasil DNS terlambat tidak memicu probe. Snapshot DNS saat itu 295/295, build/typecheck, 16 browser dan 21 runtime lulus; snapshot remediasi terbaru tercatat di bawah.
- Menambahkan README, panduan pilot/deployment terbatas, .env.example dan evidence yang membedakan mock, browser, jaringan nyata dan SQL native.

## 2026-11-19 — remediasi review independen dan snapshot gabungan

- Menolak skor bila `requestedUrl`/`finalUrl` PageSpeed hilang, berbeda dari URL probe, atau Lighthouse mengembalikan `runtimeError`. Batas laporan memeriksa ulang identitas; skor tidak dialihkan ke situs/halaman lain. Empat tracer RED→GREEN dan 19 tes fokus lulus, disusul suite gabungan 303/303. Review independen khusus PageSpeed selesai/lulus tanpa concern atau logic error; batasnya tercatat di [verdict](evidence/pagespeed-independent-review.json).
- Listener WebSocket development ditangani terpisah; `hmr:false` saja tidak menutup `server.ws` pada Vite yang terpasang. Status integrasi dan pengujian dicatat pada [remediasi review](evidence/security-review-remediation.json).
- Memperbaiki delta CSV yang semula diformat sebagai string bertanda lalu ikut dinetralisasi sebagai formula: RED exit 1 → GREEN 11/11; delta positif/negatif/nol kini angka, perlindungan judul/ringkasan tetap aktif. Byte unduhan CSV browser memuat delta numerik `3`.
- Mengintegrasikan helper development ke entry server dengan tracer integrasi RED→GREEN; `server.ws:false` dan `hmr:false` diuji melalui runtime Vite nyata untuk tiga variasi environment, tanpa listener tambahan.
- Snapshot gabungan baru: 303/303 tes, typecheck/build exit 0, aset 1/1, browser 16/16 dan runtime production-only 21/21. Sebanyak 51 input dibekukan sebelum run dan 43 input salinan runtime cocok setelahnya. Review khusus patch terakhir selesai/lulus; bukti [verdict](evidence/final-patch-independent-review.json) dan [penutupan lokal](evidence/local-verification-closure.json) disimpan. Ini bukan persetujuan publikasi.
- Audit npm terbaru produksi dan seluruh dependency sama-sama exit 0/0 temuan tanpa perubahan lockfile; snapshot lama lima high tetap historis, bukan status terbaru.
- Bukti native PostgreSQL lama dicocokkan dengan raw 72 assertion dan hash migrasi terkini; ini bukan run SQL produksi baru.
- Menyusun paket deployment HTTPS pilot satu-instance di scratch tersanitasi (52 source/config/test files; tanpa .env, .git atau docs/evidence). Pipeline clean Node22 copy: typecheck/build, aset1/1, aplikasi303/303, tes Blueprint4/4, dependency produksi setelah prune; review statis final passed tanpa finding. Paket belum di-push/deploy karena sesi Render masih login dan biaya/workspace belum diverifikasi.
- API audit lokal ke example.com mencoba PageSpeed nyata kembali: HTTP429, seluruh empat skor dan total null, tidak eligible ranking. Tidak mengganti dengan fixture; empat skor hosted masih terbuka.

## 2026-11-20 — akun hosting dan publikasi source pilot

- Memverifikasi akun/workspace Render live: Hobby, tanpa kartu, tidak ada pending charges dan batas belanja build pipeline $0.
- Mempublikasikan hanya 52 frozen source/config/test ke branch `deploy/https-pilot-20261120`, commit `414e317447d3dc843cf6a9e99a599391920743d9`; verifikasi arsip commit GitHub 52/52 hash cocok tanpa tambahan. Tidak mengubah main atau worktree sumber.
- Membatalkan permintaan kartu pada Blueprint; jalur Web Service publik memperlihatkan Free $0 yang dipilih menggantikan default $7. Auto-deploy Off dan health path dimasukkan, tetapi preview terputus saat Enter pada input branch. Tidak ada klik Deploy; akibat Enter/resource hosted belum terverifikasi. Environment dan region belum lengkap. [Handoff](evidence/https-deployment-20261119T000210Z/hosted-deployment-handoff.json).
- Adapter PageSpeed nyata lokal setelah login tetap HTTP429, keempat kategori null. Tidak ada hasil hosted atau skor pengganti.

## 2026-11-21 — pengukuran Lighthouse lokal opsional

- Menambah mode operator `MEASUREMENT_PROVIDER=lighthouse_local` khusus loopback, Chrome profil sementara dan proxy CONNECT HTTPS dengan pinning DNS serta penolakan alamat privat. Default hosted tetap PageSpeed; tidak mengubah kuota Google.
- Empat kategori Lighthouse nyata menggunakan source `lighthouse_local` dan metodologi `technical-local-v1`; versi/waktu terlihat dan hasil tidak dimasukkan peringkat PageSpeed. Tidak ada skor pengganti dari probe HTTP.
- Audit nyata PA Semarang MOBILE pada 21 November 2026 menghasilkan Performance14, Accessibility87, BestPractices77, SEO100, rata-rata69.5. Angka adalah satu run lab Mac/koneksi lokal, bukan data lapangan atau audit kepatuhan.
- Typecheck/build/output test lulus; suite320 pass0fail0skip. Browser desktop/mobile: empat skor tampil, saran dan PDF terbentuk, pageerror kosong. Guard Chrome menolak empat target lokal/private dan listener target menerima0request. Audit npm produksi0temuan. Build masih mengingatkan chunk>500kB.
- [Spesifikasi dan batas](specs/local-lighthouse.md). Tidak deploy/push/key/billing/AI/cloud mutation atau perubahan aplikasi lain. Pilot HTTPS serta PageSpeed hosted masih pending.

## 2026-11-21 — tampilan laporan lokal

- Identitas Juru Website, instruksi tanpa cloud, sumber pengukuran dan rata-rata skor lebih jelas; empat skor utama ditata dua kolom mobile/empat kolom desktop.
- Prioritas berikutnya dan tabel tindakan dipindah sebelum checklist manual; judul HTML entity diterjemahkan sebagai teks aman, bukan HTML.
- Tombol PDF ditumpuk di ponsel, deskripsi pilihan tidak dipotong; label LCP/FCP/SEO dan pemisahan ranking lokal diperjelas. Print table memakai lebar halaman.
- Typecheck/build/test-output lulus, suite321/321 tanpa skip. Browser ulang memakai hasil server nyata tersimpan cache (bukan skor baru): desktop/mobile320/390/768/1440, terang/gelap, empat skor dan PDF, tanpa pageerror; sumber hash cocok sebelum/sesudah. Review statis tambahan usai: 11 berkas integrasi server lolos tanpa temuan, hash cocok snapshot; catatan tindak lanjut berupa tes lifecycle Chrome dan fresh-profile. UI berubah sesudah snapshot review tersebut dan diperiksa pada review terpisah. Bukti di laporan `tampilan-baru` pada arsip lokal Hermes.
- Review UI menemukan kontras cetak gelap dan offset anchor; keduanya direproduksi browser lalu diperbaiki di CSS. Uji ulang321pass, build/typecheck dan browser replay: anchor96px, seluruh teks kartu cetak berwarna gelap, PDF tanpa latar terbentuk. Bukti `ui-review-disposition.json` mempertahankan verdict asli.
- Tidak deployment atau perubahan akun/biaya. Warning bundel>500kB masih ada.

## Batas penutupan

Source pilot sudah dipush; deployment hosted belum terverifikasi. Tidak ada kartu/biaya baru, provider AI live, migrasi Supabase remote atau transaksi/akun Binance. Build masih memberi peringatan chunk JS sekitar 533 kB (gzip sekitar 151 kB); optimasi pemuatan terpisah dapat dilakukan sebelum perluasan. Pilot publik tetap memerlukan persetujuan, konfigurasi HTTPS/secret/allowlist, pengujian staging dan kebijakan data. Status lengkap dan bukti ada di [FINAL_STATUS.md](FINAL_STATUS.md).
