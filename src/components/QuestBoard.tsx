import { ExternalLink, Map, ScrollText, ShieldCheck, Swords } from 'lucide-react';

export type QuestEvidenceState = 'parsial' | 'belum-diukur' | 'tindak-lanjut' | 'luar-cakupan';

export interface ReadinessQuest {
  id: string;
  title: string;
  state: QuestEvidenceState;
  requirement: string;
  nextStep: string;
  owner: string;
  acceptance: string;
  source: string;
}

export const READINESS_QUESTS: ReadinessQuest[] = [
  {
    id: 'audit-teknis', title: 'Ukur kondisi teknis halaman', state: 'parsial',
    requirement: 'Baca performa, aksesibilitas otomatis, praktik terbaik, dan SEO; jangan campurkan hasil teknis dengan penilaian kepatuhan resmi.',
    nextStep: 'Jalankan audit MOBILE pada beranda, simpan laporan dan catat waktu/metode. Jika PageSpeed tidak tersedia, tandai metrik tidak tersedia—jangan menggantinya dengan skor buatan.',
    owner: 'IT satker', acceptance: 'Empat kategori dan sumber pengukuran tercatat; nilai kosong tetap kosong.',
    source: 'Cetak Biru, hlm. 11–12; SK, hlm. 3–4',
  },
  {
    id: 'layanan-perkara', title: 'Buka jalur layanan perkara', state: 'parsial',
    requirement: 'SIPP lokal, e-Court, jadwal sidang harian, Direktori Putusan, statistik dan informasi biaya harus mudah ditemukan serta menuju tujuan yang benar.',
    nextStep: 'Periksa tiap tautan sebagai pengunjung, pastikan jadwal diperbarui, uji target SIPP/e-Court/putusan, dan dokumentasikan pemilik kontennya.',
    owner: 'IT + Kepaniteraan', acceptance: 'Semua tautan layanan terbuka, benar tujuan, jadwal bertanggal/terkini, dan alur inti maksimal dua klik.',
    source: 'Cetak Biru, hlm. 6, 8, 10',
  },
  {
    id: 'keterbukaan', title: 'Lengkapi matriks informasi publik', state: 'parsial',
    requirement: 'Periksa informasi berkala, serta-merta, tersedia setiap saat, serta informasi yang dikecualikan. Cakupan checklist Juru adalah indikator pendamping dan tidak membuktikan isi, periode, atau kelengkapan.',
    nextStep: 'Cocokkan halaman/arsip dengan daftar PPID; lengkapi Renstra, RKT, PK, IKU, LKjIP, DIPA, LRA, CALK, RUP, laporan biaya/sisa panjar, relaas ghaib, dan data yang diwajibkan.',
    owner: 'PPID + Kesekretariatan + IT', acceptance: 'Daftar dokumen per kategori, tahun, URL, pejabat pemilik, dan tanggal tinjau tersedia.',
    source: 'Cetak Biru, hlm. 7–9',
  },
  {
    id: 'konten-berkala', title: 'Buktikan kemutakhiran dan pemilik konten', state: 'tindak-lanjut',
    requirement: 'Website harus memuat informasi relevan dan mutakhir; informasi downtime/darurat serta layanan harian perlu dikelola dengan jelas.',
    nextStep: 'Tetapkan pemilik dan frekuensi tinjau untuk setiap halaman penting. Rekam tanggal pembaruan dan siapkan prosedur pengumuman gangguan.',
    owner: 'Pimpinan + pemilik konten', acceptance: 'Ada inventaris halaman, PIC, tanggal review berikutnya, dan prosedur pengumuman gangguan.',
    source: 'SK, hlm. 3; Cetak Biru, hlm. 7–8',
  },
  {
    id: 'informasi-dikecualikan', title: 'Lindungi informasi yang dikecualikan', state: 'tindak-lanjut',
    requirement: 'Advisblaad/musyawarah hakim, data pribadi tertentu dalam perkara, dan dokumen evaluasi internal tidak boleh terpublikasi.',
    nextStep: 'Minta PPID dan pejabat berwenang memeriksa sampel unggahan, metadata, berkas unduhan, indeks mesin pencari, dan prosedur redaksi sebelum publikasi.',
    owner: 'PPID + pejabat berwenang', acceptance: 'Ada persetujuan publikasi dan pemeriksaan redaksi; Juru tidak menyimpulkan isi berkas aman hanya dari tautan.',
    source: 'Cetak Biru, hlm. 7',
  },
  {
    id: 'domain-resmi', title: 'Pastikan domain resmi satker', state: 'belum-diukur',
    requirement: 'Cetak biru menyebut penggunaan domain resmi pemerintah .go.id.',
    nextStep: 'Konfirmasi domain dan kewenangannya lewat pengelola domain/instansi; audit teknis Juru tidak membuktikan kepemilikan maupun persetujuan domain.',
    owner: 'Pimpinan + pengelola domain', acceptance: 'Domain .go.id aktif, terdaftar/terotorisasi, dan ditetapkan untuk satker.',
    source: 'Cetak Biru, hlm. 6',
  },
  {
    id: 'https-redirect', title: 'Paksa seluruh akses ke HTTPS', state: 'parsial',
    requirement: 'TLS/SSL wajib aktif disertai pengalihan paksa HTTP ke HTTPS; probe pada satu URL bukan validasi seluruh hostname, sertifikat, atau konfigurasi.',
    nextStep: 'Uji HTTP, www/non-www dan seluruh subdomain resmi; verifikasi redirect, rantai sertifikat, masa berlaku, HSTS, dan mixed content.',
    owner: 'IT + pengelola hosting', acceptance: 'HTTP dialihkan ke HTTPS dengan sertifikat valid di semua hostname yang dipakai.',
    source: 'Cetak Biru, hlm. 3, 5',
  },
  {
    id: 'waf-login', title: 'Uji pertahanan aplikasi dan login', state: 'belum-diukur',
    requirement: 'WAF aktif, validasi input antisipasi SQLi/XSS, rate limiting dan MFA pada login.',
    nextStep: 'Minta administrator menguji konfigurasi WAF, kontrol input, pembatasan login dan MFA di staging; jangan menguji serangan pada produksi lewat Juru.',
    owner: 'Admin aplikasi + keamanan TI', acceptance: 'Konfigurasi dan hasil uji terotorisasi terdokumentasi tanpa membocorkan kredensial.',
    source: 'Cetak Biru, hlm. 5',
  },
  {
    id: 'infrastruktur', title: 'Periksa patch, port, dan akses admin', state: 'belum-diukur',
    requirement: 'Server/aplikasi non-EOL dan dipatch; hanya port 80/443 terbuka; akses SSH/RDP melalui VPN atau IP allowlist; lisensi resmi.',
    nextStep: 'Inventaris versi OS, server, CMS, plugin/tema, lisensi dan port; tutup temuan melalui perubahan yang disetujui admin.',
    owner: 'Admin server + pengadaan TI', acceptance: 'Inventaris versi didukung, patch rutin, port terekspos disetujui, dan lisensi dapat dibuktikan.',
    source: 'Cetak Biru, hlm. 4–5',
  },
  {
    id: 'database', title: 'Amankan basis data dan kredensial', state: 'belum-diukur',
    requirement: 'Basis data tidak diekspos ke publik, bind-address dibatasi localhost/127.0.0.1, data sensitif dilindungi, dan akun default/root tidak dipakai.',
    nextStep: 'Minta pemeriksaan konfigurasi server/DB dan bukti enkripsi dari admin berwenang; jangan masukkan rahasia ke laporan audit web.',
    owner: 'Admin basis data + keamanan TI', acceptance: 'DB tidak dapat diakses dari internet; akun dan perlindungan data ditinjau dengan bukti konfigurasi.',
    source: 'Cetak Biru, hlm. 5',
  },
  {
    id: 'backup', title: 'Buktikan backup offsite dan pemulihan', state: 'belum-diukur',
    requirement: 'Cetak biru mengarahkan backup otomatis berkala ke lokasi offsite dan pemantauan sistem.',
    nextStep: 'Cek jadwal, retensi, enkripsi, pemisahan akses, notifikasi kegagalan dan lakukan uji restore berkala bersama pengelola.',
    owner: 'Admin infrastruktur + pimpinan', acceptance: 'Ada log backup sukses dan hasil uji restore terbaru yang dapat dipertanggungjawabkan.',
    source: 'Cetak Biru, hlm. 5',
  },
  {
    id: 'aksesibilitas', title: 'Uji aksesibilitas dengan manusia dan alat bantu', state: 'parsial',
    requirement: 'Responsif, ramah screen reader, kontras memadai, zoom teks dan kendali yang bisa dioperasikan; skor Lighthouse otomatis bukan sertifikasi WCAG.',
    nextStep: 'Lanjutkan skor otomatis dengan uji keyboard, pembaca layar, kontras, pembesaran 200%, fokus, label form dan pemeriksaan pengguna.',
    owner: 'IT + PPID/pengguna layanan', acceptance: 'Temuan otomatis dan manual dicatat, diperbaiki, lalu diuji ulang pada ponsel dan desktop.',
    source: 'Cetak Biru, hlm. 3, 6; SK, hlm. 4',
  },
  {
    id: 'identitas-navigasi', title: 'Samakan identitas visual dan navigasi', state: 'belum-diukur',
    requirement: 'Cetak biru memberi acuan hijau #056e4f, aksen oranye #ff9900, menu standar dan akses layanan utama maksimal dua klik.',
    nextStep: 'Bandingkan tampilan beranda/menu dengan acuan resmi dan hitung klik ke SIPP/jadwal sidang; konfirmasi jika ada arahan versi yang lebih baru.',
    owner: 'IT + pimpinan/komunikasi', acceptance: 'Identitas dan struktur disetujui pengelola; layanan inti ditemukan dalam paling banyak dua klik.',
    source: 'Cetak Biru, hlm. 3, 6, 10',
  },
  {
    id: 'speed-broken-links', title: 'Periksa kecepatan dan tautan rusak', state: 'parsial',
    requirement: 'Target cetak biru: waktu muat optimal di bawah lima detik dan bebas tautan 404; hasil satu pengukuran lab tidak sama dengan pengalaman seluruh pengunjung.',
    nextStep: 'Ulangi uji di mobile/desktop dan jam berbeda, periksa URL internal/eksternal, prioritaskan gambar dan sumber daya berat, lalu catat error 404.',
    owner: 'IT + pemilik halaman', acceptance: 'Bukti hasil uji beserta URL 404 dan tindak perbaikan tersimpan; nilai sumber/metode disebutkan.',
    source: 'Cetak Biru, hlm. 11–12',
  },
  {
    id: 'sinova-bot', title: 'Siapkan bukti untuk evaluasi SINOVA', state: 'luar-cakupan',
    requirement: 'Materi menggambarkan bot SINOVA yang memeriksa URL/load/SSL, mengambil screenshot baku, ditinjau PTA dan dapat disanggah; skor absolut 10/5/0 milik proses evaluasi itu.',
    nextStep: 'Juru tidak menggantikan SINOVA: gunakan Juru sebagai alat diagnosis awal, lalu kirim URL/bukti melalui SINOVA dan ikuti alur PTA/Badilag; jangan menyalin skor Juru sebagai skor resmi.',
    owner: 'Operator satker → PTA → Badilag', acceptance: 'URL/dokumen dikirim dan status evaluasi/sanggah dikonfirmasi di SINOVA.',
    source: 'Cetak Biru, hlm. 12; SK, hlm. 2–6',
  },
  {
    id: 'sinova-konten', title: 'Pisahkan alur website dari manajemen konten SINOVA', state: 'luar-cakupan',
    requirement: 'SINOVA Manajemen Konten adalah alur terpisah untuk kalender, review berjenjang, publikasi, arsip, metrik dan analytics media sosial; bukan fungsi yang diklaim Juru.',
    nextStep: 'Tetap gunakan modul SINOVA untuk perencanaan dan review konten. Juru tidak membuat kalender, menyetujui konten, mengirim WhatsApp, memposting, atau menyinkronkan metrik.',
    owner: 'PIC konten + approver satker', acceptance: 'Konten diproses di SINOVA dengan pemisahan pembuat/approver dan prosedur instansi.',
    source: 'Presentasi SINOVA, hlm. 1–4, 7–11',
  },
];

const QUEST_GROUPS = [
  { id: 'pelayanan', title: 'I · Layanan & keterbukaan', icon: ScrollText, quests: READINESS_QUESTS.slice(0, 5) },
  { id: 'pertahanan', title: 'II · Pertahanan & infrastruktur', icon: ShieldCheck, quests: READINESS_QUESTS.slice(5, 11) },
  { id: 'pengalaman', title: 'III · Akses & pengalaman warga', icon: Map, quests: READINESS_QUESTS.slice(11, 14) },
  { id: 'tata-kelola', title: 'IV · Evaluasi & alur SINOVA', icon: Swords, quests: READINESS_QUESTS.slice(14) },

] as const;

const STATE_LABEL: Record<QuestEvidenceState, string> = {
  parsial: 'Terbatas · perlu bukti',
  'belum-diukur': 'Belum diukur Juru',
  'tindak-lanjut': 'Perlu tindak lanjut',
  'luar-cakupan': 'Alur resmi terpisah',
};

export function QuestBoard() {
  return (
    <section className="quest-board" aria-labelledby="quest-board-title">
      <div className="quest-board-heading">
        <div className="quest-emblem" aria-hidden="true"><Map size={22} /></div>
        <div className="quest-heading-copy">
          <span className="quest-eyebrow">FIELD GUIDE · WEBSITE SATUAN KERJA · 2026</span>
          <h2 id="quest-board-title">Peta kesiapan website 2026</h2>
          <p>{READINESS_QUESTS.length} misi pemeriksaan untuk membantu tim IT menelusuri celah—bukan hasil audit otomatis atau skor resmi.</p>
        </div>
        <a className="quest-start" href="#audit-panel">Mulai audit teknis <ExternalLink size={14} aria-hidden="true" /></a>
      </div>
      <details className="quest-log">
        <summary>
          <span className="quest-log-title"><ScrollText size={17} aria-hidden="true" /> Buka jurnal misi</span>
          <span className="quest-log-meta">3 dokumen rujukan · {READINESS_QUESTS.length} bidang · status perlu verifikasi</span>
        </summary>
        <div className="quest-caution" role="note">
          <strong>Status menunjukkan cakupan Juru, bukan kondisi satker.</strong> Peta ini panduan statis: “Terbatas” berarti Juru hanya membantu sebagian pemeriksaan; “Belum diukur” dan “Perlu tindak lanjut” memerlukan pemeriksaan manusia, bukan temuan kekurangan satker. Tautan yang teramati tidak membuktikan dokumen lengkap atau mutakhir. Juru tidak menggantikan SINOVA dan tidak menjalankan sinkronisasi media sosial. Skor resmi, persetujuan PTA/Badilag, konfigurasi server dan isi dokumen tetap diverifikasi oleh pihak berwenang.
        </div>
        {QUEST_GROUPS.map(({ id, title, icon: Icon, quests }) => (
          <section className="quest-zone" key={id} aria-labelledby={`quest-zone-${id}`}>
            <h3 id={`quest-zone-${id}`}><Icon size={16} aria-hidden="true" /> {title}</h3>
            <ol className="quest-list">
              {quests.map((quest, index) => (
                <li className="quest-card" key={quest.id}>
                  <div className="quest-card-top">
                    <span className="quest-number">{String(index + 1).padStart(2, '0')}</span>
                    <span className={`quest-status quest-status-${quest.state}`}>{STATE_LABEL[quest.state]}</span>
                  </div>
                  <h4>{quest.title}</h4>
                  <details className="quest-detail">
                    <summary>Tujuan, langkah & bukti</summary>
                    <div className="quest-detail-body">
                      <p><strong>Target:</strong> {quest.requirement}</p>
                      <p><strong>Langkah berikutnya:</strong> {quest.nextStep}</p>
                      <p><strong>Pemilik:</strong> {quest.owner}</p>
                      <p><strong>Bukti selesai:</strong> {quest.acceptance}</p>
                      <p className="quest-source"><strong>Rujukan:</strong> {quest.source}</p>
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          </section>
        ))}
        <div className="quest-footnote"><ShieldCheck size={15} aria-hidden="true" /> Checklist ini bukan sertifikat kepatuhan dan bukan teks lengkap keputusan. Buka sumber aslinya—Cetak Biru Website Badilag 2026, Materi sosialisasi SK Dirjen Badilag 2722, dan Presentasi SINOVA Manajemen Konten—lalu konfirmasikan perubahan kebijakan kepada Badilag.</div>
      </details>
    </section>
  );
}
