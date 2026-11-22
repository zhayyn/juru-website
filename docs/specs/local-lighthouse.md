# Pengukuran lokal Lighthouse — technical-local-v1

## Tujuan
Menuntaskan alur lokal URL publik HTTPS → empat skor Lighthouse nyata → saran → PDF ketika API PageSpeed menolak permintaan. Bukan perbaikan kuota Google atau penerimaan deployment.

## Kontrak
- Operator mengaktifkan `MEASUREMENT_PROVIDER=lighthouse_local` secara eksplisit. Ditolak jika server tidak di loopback. Default hosted tetap PageSpeed.
- Chrome baru dengan profil sementara, tanpa cookies/login pengguna. Browser berjalan melalui proxy loopback yang menolak alamat privat/reserved serta mem-pin DNS untuk seluruh HTTPS CONNECT; HTTP dan port selain443 ditolak. QUIC/nonproxied WebRTC dinonaktifkan.
- Kategori performance/accessibility/best-practices/seo dari Lighthouse, tidak direka atau diturunkan dari probe HTTP. Identitas requested/final harus cocok dengan probe; runtimeError membatalkan hasil.
- Rata-rata hanya ketika empat skor lengkap. Source `lighthouse_local`, versi/waktu pengukuran terlihat, methodology `technical-local-v1`, rankingEligible=false. Jangan mencampur hasil Mac dengan peringkat PageSpeed.
- Run dibatasi150detik dan browser/proxy dibersihkan. API existing single-flight/cache/batas harian tetap aktif; resource dipengaruhi mesin/koneksi Mac.
- AI/cloud ranking tetap mati. Tidak membaca .env, membuat key, billing, deploy atau menyentuh aplikasi lain.

## Menjalankan ulang di Mac

Dari folder `juru-website`, setelah `npm install` dan `npm run build`, jalankan:

```sh
/usr/bin/env -i HOME="$HOME" PATH="$PATH" NODE_ENV=production DOTENV_CONFIG_PATH=/dev/null HOST=127.0.0.1 PORT=3000 ALLOWED_HOSTS=127.0.0.1:3000,localhost:3000 AI_PROVIDER=none RANKING_PUBLISH_ENABLED=false MEASUREMENT_PROVIDER=lighthouse_local LIGHTHOUSE_CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node --import tsx server.ts
```

Buka http://127.0.0.1:3000 pada Mac yang sama. Jangan menyalakan server kedua jika port3000 sudah dipakai; identifikasi pemilik proses dahulu. Pengukuran pertama dapat memerlukan beberapa menit; hasil identik di-cache15menit. Server terminal saat ini bukan autostart. Jika halaman lama masih terbuka, refresh sebelum audit ulang.

## Acceptance
TDD parser, report boundary, UI provenance dan proxy. Typecheck, suite/build/output checks. Browser audit PA Semarang nyata harus menampilkan keempat skor dan total, saran serta PDF; null/error tetap dilaporkan sebagai belum selesai. Catat pengukuran lab lokal, bukan field Core Web Vitals/sertifikasi keamanan/kepatuhan resmi.
