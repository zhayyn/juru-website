import type { AuditFinding, ImprovementAction, PageSpeedMetrics, PillarScore, TechnicalSignals } from '../types/audit.ts';

export interface ImprovementInput {
  pageSpeed: PageSpeedMetrics;
  technicalSignals: TechnicalSignals;
  pillarScores: PillarScore[];
  findings: AuditFinding[];
}

const INDICATOR_GUIDANCE: Record<string, [string, string]> = {
  lhkpn_lhkasn: ['Tautkan dokumen pelaporan LHKPN/LHKASN resmi untuk periode dan pejabat yang berlaku; pastikan publikasi sesuai kebijakan instansi.', 'Buka tautan sebagai pengunjung, cocokkan periode dan pejabat, serta pastikan berkas dapat diakses.'],
  anggaran_dipa: ['Terbitkan DIPA, realisasi anggaran, dan LKjIP per tahun dengan arsip yang jelas.', 'Pastikan dokumen tahun berjalan dan tahun sebelumnya dapat diunduh dan diberi tanggal pembaruan.'],
  layanan_hukum: ['Jelaskan kontak/jadwal Posbakum, syarat prodeo, dan jadwal sidang keliling dalam satu halaman yang mudah dicari.', 'Uji tautan layanan dan minta pemilik layanan mengonfirmasi kontak, syarat, serta jadwal.'],
  informasi_perkara: ['Tempatkan tautan SIPP, e-Court, dan jadwal sidang yang aktif dengan deskripsi singkat.', 'Buka semua tautan dan konfirmasi halaman resmi tidak usang atau salah tujuan.'],
  panjar_biaya: ['Terbitkan tabel panjar dan radius panggilan beserta tanggal berlaku dan cara mengajukan keberatan.', 'Cocokkan nominal dengan keputusan resmi terbaru; pastikan file dan tabel dapat dibaca di ponsel.'],
  maklumat_pelayanan: ['Cantumkan jam operasional, standar waktu layanan, dan maklumat pelayanan yang masih berlaku.', 'Cocokkan jadwal dengan pengelola PTSP dan uji tampilannya di ponsel.'],
  pengaduan_siwas: ['Tautkan SIWAS/SP4N-LAPOR resmi dan jelaskan cara melapor dengan aman.', 'Uji tautan tujuan dan instruksi tanpa mengirim laporan sungguhan.'],
  survei_skm_ipk: ['Publikasikan hasil SKM/IPK terbaru dengan periode, metodologi, dan akses arsip.', 'Cocokkan angka, tanggal, dan sumber dengan laporan yang disahkan.'],
  profil_struktur: ['Perbarui profil, pejabat, visi-misi, dan tanggal pembaruan.', 'Minta pemilik konten mengesahkan nama/jabatan dan uji tautan pada ponsel.'],
  mobile_friendly: ['Uji menu, teks, tabel dan formulir pada beberapa lebar ponsel; hindari gulir horizontal.', 'Uji 390px dan perangkat nyata serta perbaiki elemen yang terpotong.'],
  navigasi_intuitif: ['Susun menu utama yang ringkas dengan elemen navigasi native (<dialog>, <details>) agar mudah dijangkau lewat keyboard maupun layar sentuh.', 'Uji buka-tutup menu dengan tombol Tab, Escape, dan ketukan di luar panel pada layar 390px.'],
  fitur_disabilitas: ['Sediakan kontrol pembesar teks, mode gelap dengan color-scheme, serta hormati prefers-reduced-motion pada setiap animasi.', 'Aktifkan mode gelap dan reduced motion di sistem operasi lalu periksa kontras dan kenyamanan baca.'],
  wcag_accessibility: ['Periksa kontras, label form, urutan keyboard, fokus dan teks alternatif secara manual.', 'Jalankan audit aksesibilitas dan uji pembaca layar; skor otomatis bukan sertifikasi WCAG.'],
  core_web_vitals: ['Prioritaskan gambar utama dengan fetchpriority="high", gunakan format AVIF/WebP berdimensi eksplisit, dan tunda skrip pihak ketiga non-kritis.', 'Uji ulang PageSpeed Insights pada strategi MOBILE dan pastikan LCP <= 2500 ms serta CLS <= 0,1.'],
  https_ssl: ['Pastikan seluruh halaman dan aset dimuat melalui HTTPS yang sah tanpa mixed content.', 'Periksa sertifikat SSL serta pastikan tidak ada permintaan aset HTTP di tab Network browser.'],
  security_headers: ['Terapkan header keamanan bertahap serta lengkapi aset CDN pihak ketiga dengan atribut integrity (SRI), crossorigin, dan referrerpolicy.', 'Periksa header respons server dan pastikan aset eksternal tetap dimuat normal tanpa error di Console.'],
  seo_teknis: ['Gunakan markup semantik (<main>, heading berurutan), atribut lang pada <html>, canonical yang tepat, serta sitemap aktif.', 'Periksa struktur DOM pada source HTML dan validasi metadata dengan alat penguji hasil pencarian.'],
  perf_assets: ['Kompres gambar ke AVIF/WebP dengan loading="lazy" untuk konten di bawah lipatan layar dan hindari muatan skrip duplikat.', 'Bandingkan total ukuran transfer pada tab Network sebelum dan sesudah optimasi.'],
  seo_crawlability: ['Pastikan robots.txt, canonical URL, dan sitemap XML dapat diakses publik dengan status HTTP 200.', 'Uji akses sitemap serta periksa cakupan pengindeksan di Search Console.'],
  ui_responsive: ['Gunakan satuan viewport dinamis (100dvh), container/grid fleksibel, dan overscroll-behavior: contain pada modal agar tampilan rapi di ponsel.', 'Buka halaman di layar 360px-430px dan pastikan modal atau panel tidak memicu gulir latar belakang.'],
  ui_navigation: ['Gunakan indikator posisi aktif (aria-current="page"), garis fokus :focus-visible yang kontras, dan penutupan dialog yang konsisten.', 'Navigasikan seluruh menu hanya dengan keyboard dan pastikan fokus kembali ke tombol pemicu saat panel ditutup.'],
  sec_https_headers: ['Tinjau HTTPS dan header keamanan bersama pengelola hosting; jangan aktifkan CSP/HSTS secara membabi buta.', 'Periksa respons final setelah redirect dan uji alur penting pada staging.'],
  perf_lcp_fcp: ['Optimalkan gambar utama, font, dan cache berdasarkan laporan Lighthouse; hindari perubahan massal tanpa ukur ulang.', 'Bandingkan metrik pada strategi/perangkat yang sama.'],
  perf_cls_tbt: ['Tetapkan ukuran ruang media, kurangi JavaScript panjang, dan tunda skrip yang bukan prioritas.', 'Ukur CLS/TBT ulang serta uji interaksi halaman.'],
  seo_metadata: ['Lengkapi judul dan ringkasan halaman yang unik, akurat, dan sesuai isi.', 'Tinjau HTML respons dan hasil pencarian setelah crawler memperbarui indeks.'],
  a11y_wcag: ['Pastikan rasio kontras teks memadai di mode terang maupun gelap, gunakan tabular-nums untuk data angka, dan lengkapi label kontrol formulir.', 'Periksa kontras warna, urutan fokus keyboard, dan pembaca layar pada halaman utama serta formulir.'],
};

export function buildImprovementPlan(input: ImprovementInput): ImprovementAction[] {
  const actions: ImprovementAction[] = [];
  const observed = input.technicalSignals.statusCode !== null;
  const add = (id: string, area: string, issue: string, recommendation: string, verification: string, severity: ImprovementAction['severity'] = 'Sedang') => actions.push({ id, area, issue, recommendation, verification, severity, source: 'Pengukuran' });

  if (observed && !input.technicalSignals.hasViewportMeta) {
    add('technical-viewport', 'Tampilan ponsel', 'Meta viewport belum terdeteksi pada HTML halaman yang diambil.', 'Tambahkan <meta name="viewport" content="width=device-width, initial-scale=1"> dan gunakan layout responsif.', 'Buka kembali halaman pada lebar 390px dan ponsel; pastikan teks nyaman dibaca tanpa gulir horizontal.');
  }
  if ([input.pageSpeed.performanceScore, input.pageSpeed.accessibilityScore, input.pageSpeed.bestPracticesScore, input.pageSpeed.seoScore].some((score) => score === null)) {
    add('measurement-pagespeed', 'Kelengkapan pengukuran', 'Sebagian atau seluruh metrik Lighthouse belum tersedia; jangan menafsirkan data kosong sebagai lulus atau gagal.', 'Ukur ulang melalui PageSpeed Insights pada strategi yang sama setelah kuota atau koneksi pulih. Jangan mengklaim waktu respons server sebagai pengganti Core Web Vitals.', 'Pastikan skor Performance, Accessibility, Best Practices dan SEO serta waktu pengukurannya tersedia.');
  }
  if (input.pageSpeed.lcpMs !== null && input.pageSpeed.lcpMs > 2500) add('technical-lcp', 'Kecepatan konten utama', `LCP terukur ${input.pageSpeed.lcpMs} ms.`, 'Kompres gambar utama ke WebP/AVIF, tetapkan ukuran gambar, prioritaskan gambar hero dan aktifkan cache; ukur kembali sebelum mengubah plugin.', 'Ukur strategi yang sama dan targetkan LCP ≤ 2500 ms.', input.pageSpeed.lcpMs > 4000 ? 'Tinggi' : 'Sedang');
  if (input.pageSpeed.clsNum !== null && input.pageSpeed.clsNum > 0.1) add('technical-cls', 'Kestabilan tampilan', `CLS terukur ${input.pageSpeed.clsNum}.`, 'Tetapkan width/height atau aspect-ratio pada gambar, iframe dan banner; sisakan ruang untuk widget dan hindari menyisipkan konten di atas halaman.', 'Ukur ulang dan targetkan CLS ≤ 0,1 tanpa pergeseran saat halaman dimuat.');
  if (input.pageSpeed.tbtMs !== null && input.pageSpeed.tbtMs > 200) add('technical-tbt', 'Respons interaksi', `TBT laboratorium terukur ${input.pageSpeed.tbtMs} ms; ini bukan INP lapangan.`, 'Kurangi JavaScript/plugin yang tidak digunakan, tunda skrip pihak ketiga dan pecah pekerjaan panjang.', 'Ukur ulang TBT pada strategi sama; targetkan ≤ 200 ms dan uji klik/menu secara manual.');
  if (observed) {
    const headers = input.technicalSignals.securityHeaders;
    if (!headers.csp) add('header-csp', 'Kebijakan konten', 'Header Content-Security-Policy tidak terdeteksi; ini bukan bukti situs telah disusupi.', 'Inventarisasi sumber skrip, gambar dan font. Mulai dengan Content-Security-Policy-Report-Only di staging sebelum enforcement.', 'Periksa response header dan console; pastikan form, CAPTCHA dan menu tetap berfungsi.');
    if (!headers.hsts && input.technicalSignals.httpsValid) add('header-hsts', 'Koneksi terenkripsi', 'Header Strict-Transport-Security tidak terdeteksi.', 'Pastikan HTTPS dan sertifikat seluruh subdomain siap, lalu uji HSTS dengan max-age pendek; jangan langsung preload atau includeSubDomains.', 'Periksa header setelah redirect; uji seluruh layanan dan subdomain terdampak.');
    if (!headers.xContentTypeOptions) add('header-nosniff', 'Tipe berkas', 'Header X-Content-Type-Options tidak terdeteksi.', 'Atur X-Content-Type-Options: nosniff dan Content-Type yang benar pada server/CDN.', 'Periksa response header dan uji unduhan PDF, CSS serta JavaScript.');
    if (!headers.xFrameOptions && !headers.csp) add('header-frame', 'Perlindungan penyisipan', 'X-Frame-Options dan CSP tidak terdeteksi.', 'Tentukan kebutuhan embedding, lalu atur X-Frame-Options atau CSP frame-ancestors pada staging.', 'Pastikan situs tidak dapat di-iframe oleh origin asing tanpa merusak embedding resmi.');

    const modernWeb = input.technicalSignals.modernWeb;
    if (modernWeb) {
      if (modernWeb.unverifiedExternalAssets > 0) {
        add(
          'modern-sri',
          'Integritas aset eksternal',
          `Terdeteksi ${modernWeb.unverifiedExternalAssets} skrip atau stylesheet CDN pihak ketiga tanpa verifikasi Subresource Integrity (integrity).`,
          'Tambahkan atribut integrity="sha384-..." atau sha512, crossorigin="anonymous", dan referrerpolicy="no-referrer" pada tag <script> dan <link> CDN berversi tetap.',
          'Periksa HTML halaman dan pastikan aset CDN termuat bersih tanpa error integritas pada Console browser.',
          'Sedang',
        );
      }
      if (!modernWeb.hasLangAttribute) {
        add(
          'modern-lang',
          'Atribut bahasa dokumen',
          'Atribut lang pada elemen html belum terdeteksi pada HTML halaman.',
          'Tambahkan atribut bahasa yang sesuai (misalnya <html lang="id">) agar pembaca layar dan mesin pencari mengenali bahasa utama situs dengan tepat.',
          'Periksa tag pembuka <html> pada source HTML dan pastikan atribut lang sudah terpasang.',
          'Rendah',
        );
      }
      if (!modernWeb.hasMainLandmark) {
        add(
          'modern-main',
          'Struktur semantik halaman',
          'Landmark konten utama (elemen main atau role="main") belum terdeteksi pada HTML halaman.',
          'Bungkus konten inti halaman dengan elemen semantik <main> sehingga pengguna keyboard dan teknologi bantu dapat langsung melompat ke isi utama.',
          'Periksa struktur DOM halaman dan pastikan hanya terdapat satu elemen <main> untuk konten utama.',
          'Rendah',
        );
      }
      if (modernWeb.prefixedMaskWithoutStandard) {
        add(
          'modern-css-mask',
          'Kompatibilitas properti CSS',
          'Terdapat deklarasi CSS -webkit-mask atau -webkit-mask-image tanpa properti standar mask/mask-image.',
          'Sertakan properti standar mask atau mask-image berdampingan dengan versi berawalan -webkit- sesuai standar CSS Masking modern.',
          'Periksa aturan CSS terkait dan uji tampilan elemen pada beberapa browser modern.',
          'Rendah',
        );
      }
    }
  }

  for (const pillar of input.pillarScores) {
    for (const indicator of pillar.indicators) {
      if (indicator.status === 'Terpenuhi') continue;
      const guidance = INDICATOR_GUIDANCE[indicator.id];
      const unverified = indicator.status === 'Belum Diverifikasi';
      actions.push({
        id: `indicator-${indicator.id}`, area: unverified ? `Verifikasi: ${indicator.name}` : indicator.name, severity: unverified ? 'Rendah' : 'Sedang', source: 'Indikator',
        issue: `${indicator.status === 'Belum Diverifikasi' ? 'Belum diverifikasi' : indicator.status}: ${indicator.note}. Cakupan pemeriksaan terbatas, bukan kesimpulan ketiadaan informasi.`,
        recommendation: unverified ? `Verifikasi dahulu URL, berkas dan periode yang relevan bersama pemilik konten; jangan mengubah situs sebelum kekurangan terbukti. ${guidance?.[0] ?? ''}` : guidance?.[0] ?? `Tinjau ${indicator.name.toLowerCase()} pada halaman terkait; perbaiki kekurangan yang benar-benar terbukti bersama pengelola.`,
        verification: guidance?.[1] ?? 'Catat URL, tanggal pemeriksaan dan bukti halaman; uji ulang setelah perubahan.',
      });
    }
  }
  const seen = new Set<string>();
  for (const finding of input.findings) {
    const key = `${finding.area}|${finding.issue}|${finding.recommendation}`.trim().toLowerCase();
    if (!finding.issue.trim() || seen.has(key)) continue;
    seen.add(key);
    actions.push({ ...finding, id: `ai-${seen.size}`, source: 'AI — perlu konfirmasi', verification: 'Cocokkan saran AI dengan halaman/URL dan bukti aktual sebelum membuat perubahan; jalankan audit ulang setelahnya.' });
  }
  const priority = { Tinggi: 0, Sedang: 1, Rendah: 2 };
  return actions.sort((a, b) => priority[a.severity] - priority[b.severity]);
}
