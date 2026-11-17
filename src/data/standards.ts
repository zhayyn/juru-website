import type { AuditCategory, AuditHistoryEntry, WebsiteRanking } from '../types/audit';

export interface IndicatorDefinition {
  id: string;
  name: string;
  description: string;
}

export interface PillarDefinition {
  id: string;
  name: string;
  weight: number;
  weightLabel: string;
  description: string;
  indicators: IndicatorDefinition[];
}

export interface AuditStandardDefinition {
  id: AuditCategory;
  title: string;
  shortTitle: string;
  regulationRef: string;
  description: string;
  pillars: PillarDefinition[];
}

export const AUDIT_STANDARDS: Record<AuditCategory, AuditStandardDefinition> = {
  peradilan_agama: {
    id: 'peradilan_agama',
    title: 'Standar Peradilan Agama',
    shortTitle: 'Peradilan Agama',
    regulationRef: 'SK Dirjen Badilag 2722/2026 & SK KMA 2-144/2022',
    description:
      'Penilaian menyeluruh bagi situs web pengadilan agama mencakup keterbukaan informasi untuk masyarakat, kemudahan akses bagi penyandang disabilitas, serta kecepatan dan keamanan layanan.',
    pillars: [
      {
        id: 'pilar_1_konten',
        name: 'Kelengkapan Informasi Publik',
        weight: 0.4,
        weightLabel: '40%',
        description:
          'Memastikan informasi penting yang dibutuhkan masyarakat pencari keadilan tersedia lengkap dan mudah ditemukan.',
        indicators: [
          {
            id: 'profil_struktur',
            name: 'Profil & Struktur Organisasi',
            description: 'Menampilkan profil satuan kerja, visi-misi, serta susunan pimpinan dan hakim terbaru.',
          },
          {
            id: 'lhkpn_lhkasn',
            name: 'Laporan Kekayaan Pejabat (LHKPN)',
            description: 'Ketersediaan publikasi bukti pelaporan harta kekayaan pejabat sebagai wujud transparansi.',
          },
          {
            id: 'anggaran_dipa',
            name: 'Transparansi Anggaran & Kinerja',
            description: 'Informasi dokumen anggaran (DIPA), laporan realisasi, dan capaian kinerja (LKjIP) terkini.',
          },
          {
            id: 'layanan_hukum',
            name: 'Layanan Bantuan Hukum',
            description: 'Informasi jelas mengenai Posbakum, pembebasan biaya (prodeo), dan jadwal sidang keliling.',
          },
          {
            id: 'informasi_perkara',
            name: 'Layanan & Jadwal Perkara',
            description: 'Kemudahan akses menuju penelusuran perkara (SIPP), jadwal sidang harian, dan e-Court.',
          },
          {
            id: 'panjar_biaya',
            name: 'Rincian Biaya Perkara',
            description: 'Keterbukaan tabel radius panggilan dan perkiraan panjar biaya perkara yang mudah dipahami.',
          },
          {
            id: 'maklumat_pelayanan',
            name: 'Standar & Maklumat Pelayanan',
            description: 'Kejelasan jam operasional layanan terpadu (PTSP) dan komitmen pelayanan kepada masyarakat.',
          },
          {
            id: 'pengaduan_siwas',
            name: 'Saluran Pengaduan Masyarakat',
            description: 'Tersedianya tautan dan tata cara penyampaian pengaduan melalui SIWAS atau SP4N-LAPOR.',
          },
          {
            id: 'survei_skm_ipk',
            name: 'Hasil Survei Kepuasan Masyarakat',
            description: 'Publikasi hasil survei kepuasan layanan dan indeks persepsi antikorupsi secara berkala.',
          },
        ],
      },
      {
        id: 'pilar_2_uiux',
        name: 'Kenyamanan Tampilan & Ramah Disabilitas',
        weight: 0.3,
        weightLabel: '30%',
        description:
          'Menilai seberapa nyaman situs web dibaca di ponsel maupun komputer, termasuk fasilitas bantu bagi penyandang disabilitas dan lansia.',
        indicators: [
          {
            id: 'mobile_friendly',
            name: 'Tampilan Rapi di Ponsel',
            description: 'Halaman menyesuaikan ukuran layar ponsel dengan baik tanpa perlu menggeser layar ke samping.',
          },
          {
            id: 'navigasi_intuitif',
            name: 'Menu Jelas & Mudah Dibaca',
            description: 'Susunan menu tidak membingungkan, ukuran huruf nyaman, dan warna tulisan terlihat jelas.',
          },
          {
            id: 'fitur_disabilitas',
            name: 'Fasilitas Ramah Disabilitas',
            description: 'Tersedia alat bantu seperti pembesar huruf, mode kontras tinggi, atau pembaca suara untuk kelompok rentan.',
          },
          {
            id: 'wcag_accessibility',
            name: 'Kesesuaian Standar Aksesibilitas',
            description: 'Elemen halaman dan tombol mudah dikenali oleh alat bantu pembaca layar bagi tunanetra.',
          },
        ],
      },
      {
        id: 'pilar_3_infrastruktur',
        name: 'Kecepatan & Keamanan Situs',
        weight: 0.3,
        weightLabel: '30%',
        description:
          'Mengukur seberapa cepat halaman terbuka saat diakses pengunjung serta perlindungan koneksi aman bagi pengguna.',
        indicators: [
          {
            id: 'core_web_vitals',
            name: 'Kecepatan Muat Halaman',
            description: 'Waktu tunggu pengunjung hingga konten utama tampil utuh dan stabil di layar.',
          },
          {
            id: 'https_ssl',
            name: 'Koneksi Terenkripsi (HTTPS)',
            description: 'Situs menggunakan gembok keamanan aktif sehingga akses pengunjung terlindungi.',
          },
          {
            id: 'security_headers',
            name: 'Perlindungan Keamanan Tambahan',
            description: 'Pengaturan keamanan bawaan situs untuk mencegah penyalahgunaan halaman oleh pihak luar.',
          },
          {
            id: 'seo_teknis',
            name: 'Kemudahan Ditemukan di Google',
            description: 'Struktur halaman dan judul tertulis rapi sehingga masyarakat mudah menemukannya di pencarian.',
          },
        ],
      },
    ],
  },
  umum: {
    id: 'umum',
    title: 'Website Umum',
    shortTitle: 'Website Umum',
    regulationRef: 'Standar Kenyamanan, Kecepatan & Keamanan Web Modern',
    description:
      'Penilaian menyeluruh untuk website instansi pemerintah, portal berita, kampus, perusahaan, maupun UMKM agar cepat diakses, aman, dan nyaman bagi pengunjung.',
    pillars: [
      {
        id: 'pilar_1_performance',
        name: 'Kecepatan Buka Halaman',
        weight: 0.35,
        weightLabel: '35%',
        description:
          'Seberapa cepat halaman terbuka dan siap disentuh oleh pengunjung tanpa terasa lambat atau tersendat.',
        indicators: [
          {
            id: 'perf_lcp_fcp',
            name: 'Waktu Tampil Konten Utama',
            description: 'Seberapa cepat bagian paling penting halaman muncul setelah alamat website dibuka.',
          },
          {
            id: 'perf_cls_tbt',
            name: 'Kestabilan Tampilan Saat Dimuat',
            description: 'Memastikan tulisan dan tombol tidak meloncat atau bergeser tiba-tiba saat halaman dimuat.',
          },
          {
            id: 'perf_assets',
            name: 'Efisiensi Gambar & Respon Situs',
            description: 'Ukuran gambar yang ringan sehingga hemat kuota dan cepat merespons permintaan pengunjung.',
          },
        ],
      },
      {
        id: 'pilar_2_seo',
        name: 'Keterbacaan di Mesin Pencari',
        weight: 0.25,
        weightLabel: '25%',
        description:
          'Memastikan nama layanan, judul halaman, dan informasi utama mudah dikenali serta muncul rapi di Google.',
        indicators: [
          {
            id: 'seo_metadata',
            name: 'Judul & Ringkasan Halaman',
            description: 'Setiap halaman memiliki judul dan ringkasan deskriptif yang membantu calon pengunjung.',
          },
          {
            id: 'seo_crawlability',
            name: 'Keterindeksan & Pembaruan Informasi',
            description: 'Halaman aktif ditemukan di pencarian Google dengan informasi terbaru yang jelas.',
          },
        ],
      },
      {
        id: 'pilar_3_uiux',
        name: 'Kenyamanan Tampilan & Ponsel',
        weight: 0.2,
        weightLabel: '20%',
        description:
          'Menilai kemudahan navigasi dan kerapian tata letak ketika dibuka dari ponsel maupun komputer.',
        indicators: [
          {
            id: 'ui_responsive',
            name: 'Kerapian di Layar Ponsel',
            description: 'Seluruh isi halaman tetap proporsional dan mudah dibaca di layar berukuran kecil.',
          },
          {
            id: 'ui_navigation',
            name: 'Alur Menu & Navigasi',
            description: 'Pengunjung dapat langsung menemukan menu utama, layanan, dan informasi kontak tanpa bingung.',
          },
        ],
      },
      {
        id: 'pilar_4_security_a11y',
        name: 'Keamanan & Kemudahan Akses',
        weight: 0.2,
        weightLabel: '20%',
        description:
          'Memastikan situs aman dikunjungi serta ramah bagi seluruh kalangan termasuk pengguna berkebutuhan khusus.',
        indicators: [
          {
            id: 'sec_https_headers',
            name: 'Koneksi Aman & Proteksi Halaman',
            description: 'Sertifikat keamanan aktif serta perlindungan dasar agar pengunjung terlindungi saat mengakses situs.',
          },
          {
            id: 'a11y_wcag',
            name: 'Kontras Warna & Kemudahan Navigasi',
            description: 'Warna teks cukup kontras terhadap latar belakang dan nyaman dioperasikan tanpa kesulitan.',
          },
        ],
      },
    ],
  },
};

export const QUICK_TEST_DOMAINS: Array<{
  label: string;
  url: string;
  category: AuditCategory;
}> = [
  { label: 'PA Semarang', url: 'https://pa-semarang.go.id', category: 'peradilan_agama' },
  { label: 'PA Jakarta Selatan', url: 'https://pa-jakartaselatan.go.id', category: 'peradilan_agama' },
  { label: 'Badilag MA RI', url: 'https://badilag.mahkamahagung.go.id', category: 'peradilan_agama' },
  { label: 'Indonesia.go.id', url: 'https://indonesia.go.id', category: 'umum' },
];

export const SAMPLE_LOCAL_RANKINGS: WebsiteRanking[] = [
  {
    domain: 'pa-semarang.go.id',
    site_name: 'Pengadilan Agama Semarang',
    category: 'peradilan_agama',
    total_score: 91.4,
    score_delta: 3.2,
    grade: 'A (Unggul)',
    audit_count: 4,
    last_audited_at: '2026-11-17T06:45:00.000Z',
    pillar_scores: {
      pilar_1_konten: 94.0,
      pilar_2_uiux: 90.0,
      pilar_3_infrastruktur: 89.3,
    },
    findings_summary:
      'Informasi publik seperti anggaran, laporan kekayaan pejabat, layanan perkara, dan pengaduan sudah tersedia lengkap. Mengecilkan ukuran foto beranda akan membuat halaman terbuka lebih cepat.',
  },
  {
    domain: 'pa-jakartaselatan.go.id',
    site_name: 'Pengadilan Agama Jakarta Selatan',
    category: 'peradilan_agama',
    total_score: 88.7,
    score_delta: 1.8,
    grade: 'B (Baik)',
    audit_count: 3,
    last_audited_at: '2026-11-17T05:20:00.000Z',
    pillar_scores: {
      pilar_1_konten: 92.5,
      pilar_2_uiux: 87.0,
      pilar_3_infrastruktur: 85.3,
    },
    findings_summary:
      'Menu layanan perkara dan alat bantu disabilitas berfungsi baik. Disarankan mengompres berkas pengumuman agar lebih ringan diunduh lewat ponsel.',
  },
  {
    domain: 'pa-surabaya.go.id',
    site_name: 'Pengadilan Agama Surabaya',
    category: 'peradilan_agama',
    total_score: 84.2,
    score_delta: -1.4,
    grade: 'B (Baik)',
    audit_count: 5,
    last_audited_at: '2026-11-16T14:15:00.000Z',
    pillar_scores: {
      pilar_1_konten: 89.0,
      pilar_2_uiux: 82.0,
      pilar_3_infrastruktur: 80.0,
    },
    findings_summary:
      'Informasi Posbakum dan layanan gugatan mandiri sudah terpasang. Perlu memperjelas warna tulisan pada daftar menu turunan agar lebih mudah dibaca.',
  },
  {
    domain: 'mahkamahagung.go.id',
    site_name: 'Mahkamah Agung Republik Indonesia',
    category: 'umum',
    total_score: 86.5,
    score_delta: 2.1,
    grade: 'B (Baik)',
    audit_count: 2,
    last_audited_at: '2026-11-16T09:30:00.000Z',
    pillar_scores: {
      pilar_1_performance: 82.0,
      pilar_2_seo: 92.0,
      pilar_3_uiux: 88.0,
      pilar_4_security_a11y: 86.0,
    },
    findings_summary:
      'Situs sangat mudah ditemukan di mesin pencari dan memiliki koneksi aman yang baik. Waktu muat awal pada jaringan seluler masih bisa dipercepat.',
  },
  {
    domain: 'pa-bandung.go.id',
    site_name: 'Pengadilan Agama Bandung',
    category: 'peradilan_agama',
    total_score: 79.6,
    score_delta: 4.5,
    grade: 'C (Cukup)',
    audit_count: 3,
    last_audited_at: '2026-11-15T11:10:00.000Z',
    pillar_scores: {
      pilar_1_konten: 85.0,
      pilar_2_uiux: 76.0,
      pilar_3_infrastruktur: 76.0,
    },
    findings_summary:
      'Dokumen laporan kinerja terbaru sudah tersedia, namun tabel biaya perkara perlu disesuaikan agar rapi saat dibuka di layar ponsel.',
  },
];

export const SAMPLE_LOCAL_HISTORY: Record<string, AuditHistoryEntry[]> = {
  'pa-semarang.go.id': [
    {
      id: 'hist-1',
      domain: 'pa-semarang.go.id',
      site_name: 'Pengadilan Agama Semarang',
      category: 'peradilan_agama',
      total_score: 81.2,
      grade: 'B (Baik)',
      pillar_scores: { pilar_1_konten: 84, pilar_2_uiux: 79, pilar_3_infrastruktur: 79.7 },
      findings_summary: 'Laporan realisasi anggaran triwulan belum lengkap dan gambar beranda masih berukuran besar.',
      audited_at: '2026-08-12T08:15:00.000Z',
    },
    {
      id: 'hist-2',
      domain: 'pa-semarang.go.id',
      site_name: 'Pengadilan Agama Semarang',
      category: 'peradilan_agama',
      total_score: 85.0,
      grade: 'B (Baik)',
      pillar_scores: { pilar_1_konten: 88, pilar_2_uiux: 84, pilar_3_infrastruktur: 82 },
      findings_summary: 'Penambahan tautan e-Court dan perapian menu layanan terpadu memudahkan pengunjung.',
      audited_at: '2026-09-20T10:00:00.000Z',
    },
    {
      id: 'hist-3',
      domain: 'pa-semarang.go.id',
      site_name: 'Pengadilan Agama Semarang',
      category: 'peradilan_agama',
      total_score: 88.2,
      grade: 'B (Baik)',
      pillar_scores: { pilar_1_konten: 91, pilar_2_uiux: 87, pilar_3_infrastruktur: 85.7 },
      findings_summary: 'Alat bantu ramah disabilitas sudah aktif dan keamanan koneksi situs meningkat.',
      audited_at: '2026-10-18T13:30:00.000Z',
    },
    {
      id: 'hist-4',
      domain: 'pa-semarang.go.id',
      site_name: 'Pengadilan Agama Semarang',
      category: 'peradilan_agama',
      total_score: 91.4,
      grade: 'A (Unggul)',
      pillar_scores: { pilar_1_konten: 94, pilar_2_uiux: 90, pilar_3_infrastruktur: 89.3 },
      findings_summary: 'Informasi publik terpenuhi lengkap. Mengecilkan ukuran foto beranda dapat mempercepat tampilan awal.',
      audited_at: '2026-11-17T06:45:00.000Z',
    },
  ],
};
