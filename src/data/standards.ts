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
    regulationRef: 'Checklist pendamping; perlu verifikasi regulasi berlaku, bukan audit kepatuhan resmi.',
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

export const SAMPLE_LOCAL_RANKINGS: WebsiteRanking[] = [];

export const SAMPLE_LOCAL_HISTORY: Record<string, AuditHistoryEntry[]> = {};
