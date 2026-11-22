import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuestBoard, READINESS_QUESTS } from './QuestBoard.tsx';

const missionIds = [
  'audit-teknis', 'layanan-perkara', 'keterbukaan', 'konten-berkala', 'informasi-dikecualikan',
  'domain-resmi', 'https-redirect', 'waf-login', 'infrastruktur', 'database', 'backup',
  'aksesibilitas', 'identitas-navigasi', 'speed-broken-links', 'sinova-bot', 'sinova-konten',
];

test('quest journal renders each distinct readiness mission once and derives both counts from the mission data', () => {
  const html = renderToStaticMarkup(<QuestBoard />);
  assert.deepEqual(READINESS_QUESTS.map(quest => quest.id), missionIds);
  assert.equal(new Set(READINESS_QUESTS.map(quest => quest.id)).size, READINESS_QUESTS.length);
  assert.equal((html.match(/class="quest-card"/g) ?? []).length, READINESS_QUESTS.length);
  assert.match(html, new RegExp(`${READINESS_QUESTS.length} misi pemeriksaan`));
  assert.match(html, new RegExp(`${READINESS_QUESTS.length} bidang`));
  assert.ok(READINESS_QUESTS.every(quest => quest.requirement && quest.nextStep && quest.owner && quest.acceptance && quest.source));
});

test('static coverage labels never imply that a satker has been audited or has missing documents', () => {
  const html = renderToStaticMarkup(<QuestBoard />);
  assert.match(html, /Peta kesiapan website 2026/);
  assert.match(html, /bukan hasil audit otomatis/);
  assert.match(html, /Status menunjukkan cakupan Juru, bukan kondisi satker/);
  for (const label of ['Terbatas · perlu bukti', 'Belum diukur Juru', 'Perlu tindak lanjut', 'Alur resmi terpisah']) {
    assert.ok(html.includes(label));
  }
  assert.match(html, /Cetak Biru Website Badilag 2026/);
  assert.match(html, /Materi sosialisasi SK Dirjen Badilag 2722/);
  assert.match(html, /Presentasi SINOVA Manajemen Konten/);
  assert.match(html, /bukan teks lengkap keputusan/);
  assert.match(html, /bukan sertifikat kepatuhan/);
  assert.doesNotMatch(html, /quest-status-(?:verified|complete)|100% patuh|kepatuhan terpenuhi/i);
});

test('excluded information is protected and the two SINOVA workflows stay outside Juru', () => {
  const html = renderToStaticMarkup(<QuestBoard />);
  assert.match(html, /Lindungi informasi yang dikecualikan/);
  assert.match(html, /tidak boleh terpublikasi/);
  assert.match(html, /Juru tidak menggantikan SINOVA/);
  assert.match(html, /tidak menjalankan sinkronisasi media sosial/);
  const official = READINESS_QUESTS.find(quest => quest.id === 'sinova-bot')!;
  const content = READINESS_QUESTS.find(quest => quest.id === 'sinova-konten')!;
  assert.equal(official.state, 'luar-cakupan');
  assert.equal(content.state, 'luar-cakupan');
  assert.match(official.requirement, /10\/5\/0/);
  assert.match(content.requirement, /media sosial/);
  assert.match(content.nextStep, /tidak membuat kalender/);
});
