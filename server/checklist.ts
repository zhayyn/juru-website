import { AUDIT_STANDARDS } from '../src/data/standards.ts';
import type { AuditCategory, IndicatorStatus, PageSpeedMetrics, PillarScore, SubIndicatorResult, TechnicalSignals } from '../src/types/audit.ts';

export const CHECKLIST_VERSION = 'automatic-checklist-v1';
export interface ChecklistEvidence { source: 'html' | 'headers' | 'lighthouse'; url: string; detail: string }
export type ChecklistIndicator = SubIndicatorResult & { evidence: ChecklistEvidence[]; checkMode: 'automatic' | 'partial' | 'manual'; ruleVersion: string };
export type ChecklistPillar = Omit<PillarScore, 'indicators'> & { indicators: ChecklistIndicator[] };
export interface ChecklistSummary {
  total: number; automatic: number; partial: number; manual: number;
  withEvidence: number; coveragePercent: number;
  statusCounts: Record<IndicatorStatus, number>; checkedAt?: string;
}
export interface ChecklistInput {
  url: string; category: AuditCategory; html?: string | null;
  technicalSignals: TechnicalSignals; pageSpeed: PageSpeedMetrics; checkedAt?: string;
}
export interface AutomaticChecklistResult { pillarScores: ChecklistPillar[]; checklistVersion: string; checklistSummary: ChecklistSummary }

const COURT_RULES: Record<string, RegExp> = {
  profil_struktur: /\b(?:profil|struktur[\s_-]*organisasi|visi[\s_-]*misi)\b/i,
  lhkpn_lhkasn: /\b(?:lhkpn|lhkasn)\b/i,
  anggaran_dipa: /\b(?:dipa|anggaran|lkjip|realisasi[\s_-]*anggaran)\b/i,
  layanan_hukum: /\b(?:posbakum|prodeo|sidang[\s_-]*keliling|bantuan[\s_-]*hukum)\b/i,
  informasi_perkara: /\b(?:sipp|e[\s_-]*court|jadwal[\s_-]*sidang)\b/i,
  panjar_biaya: /\b(?:panjar|radius[\s_-]*panggilan|biaya[\s_-]*perkara)\b/i,
  maklumat_pelayanan: /\b(?:maklumat|standar[\s_-]*pelayanan|ptsp)\b/i,
  pengaduan_siwas: /\b(?:pengaduan|siwas|sp4n)\b/i,
  survei_skm_ipk: /\b(?:survei[\s_-]*kepuasan|skm|ipk|ikm)\b/i,
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (all, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2),16) : parseInt(code.slice(1),10);
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '';
    }
    return ({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '} as Record<string,string>)[code.toLowerCase()] ?? all;
  });
}
function attrs(tag: string): Record<string,string> {
  const result: Record<string,string> = Object.create(null);
  for (const m of tag.replace(/^<\/?[\w:-]+/, '').matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    const key = m[1].toLowerCase();
    if (!(key in result)) result[key] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return result;
}
/** Bounded lexical observation, not a rendering engine: uncertain markup is not compliance. */
function observeHtml(html: string | null | undefined, accessible: boolean) {
  const links: Array<{href:string; text:string}> = [];
  let viewport = false; let title = ''; let description = ''; let hasBase = false;
  if (!accessible || !html || Buffer.byteLength(html,'utf8') > 1024*1024) return {links, viewport, title, description};
  const stack: Array<{tag:string; hidden:boolean}> = [];
  let raw: string | null = null; let tokens = 0;
  const empty = () => ({links: [] as Array<{href:string; text:string}>, viewport: false, title: '', description: ''});
  let anchor: {href:string; text:string} | null = null;
  for (const m of html.matchAll(/<!--[\s\S]*?(?:-->|$)|<(?:[^"'<>]|"[^"]*"|'[^']*')*>|[^<]+|</g)) {
    const token=m[0];
    if (++tokens > 20000) return empty();
    if (token.startsWith('<!--')) continue;
    if (raw) {
      if (new RegExp(`^</${raw}\\s*>$`,'i').test(token)) raw=null;
      else {if(raw==='title' && !token.startsWith('<')) title+=decodeEntities(token).replace(/\s+/g,' ');continue;}
    }
    if (token.startsWith('<')) {
      const tag=token.match(/^<\/?([a-z][\w:-]*)/i)?.[1].toLowerCase();
      if (!tag) continue;
      const closing=token.startsWith('</');
      if (!closing && ['script','style','textarea','xmp','iframe','noscript','title'].includes(tag)) {raw=tag;continue;}
      if (closing) {
        if (tag==='a' && anchor) {if (links.length<500) links.push(anchor);anchor=null;}
        const index=stack.map(s=>s.tag).lastIndexOf(tag); if(index>=0) stack.splice(index);
        continue;
      }
      const a=attrs(token);
      if(tag==='base') hasBase=true;
      const hidden=stack.some(s=>s.hidden) || ['template','svg'].includes(tag) || 'hidden' in a || a['aria-hidden']==='true' || /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(a.style ?? '');
      if (!hidden && tag==='a') anchor={href:a.href ?? '',text:''};
      if (!hidden && tag==='meta') {
        if(a.name?.toLowerCase()==='viewport' && /width\s*=\s*device-width/i.test(a.content ?? '')) viewport=true;
        if(a.name?.toLowerCase()==='description') description=a.content?.trim() ?? '';
      }
      if(!['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'].includes(tag)) stack.push({tag,hidden});
      if(stack.length>128) return empty();
      continue;
    }
    if (!stack.some(s=>s.hidden)) {
      const text=decodeEntities(token).replace(/\s+/g,' ');
      if(anchor) anchor.text+=text;

    }
  }
  return {links:(hasBase ? [] : links).map(l=>({...l,text:l.text.replace(/\s+/g,' ').trim().slice(0,240)})), viewport, title:title.trim(), description};
}
function publicLink(href: string, base: URL): URL | null {
  try {
    if(!href.trim()) return null;
    const u=new URL(href,base);
    if(!['http:','https:'].includes(u.protocol) || u.origin!==base.origin || u.username || u.password || u.search || u.hash) return null;
    const path=decodeURIComponent(u.pathname);
    if (/(?:^|\/)(?:admin|login|logout|signin|auth|account|private)(?:[\/._-]|$)/i.test(path)) return null;
    return u;
  } catch {return null;}
}

export function evaluateAutomaticChecklist(input: ChecklistInput): AutomaticChecklistResult {
  const standard = AUDIT_STANDARDS[input.category];
  if (!standard) throw new TypeError('Kategori checklist tidak valid.');
  const pillarScores: ChecklistPillar[] = standard.pillars.map(p => ({
    id: p.id, name: p.name, weight: p.weight, score: null, weightedContribution: null,
    summary: 'Checklist satu halaman, bukan audit kepatuhan resmi; tidak memengaruhi ranking teknis.',
    indicators: p.indicators.map(i => ({ id: i.id, name: i.name, status: 'Belum Diverifikasi', score: null, maxScore: 100,
      note: `${i.description} Perlu verifikasi manual; tidak teramati bukan berarti tidak tersedia.`,
      evidence: [], checkMode: 'manual', ruleVersion: CHECKLIST_VERSION })),
  }));
  const indicators = pillarScores.flatMap(p => p.indicators);
  const accessible = input.technicalSignals.statusCode !== null && input.technicalSignals.statusCode >= 200 && input.technicalSignals.statusCode < 300;
  const observed = observeHtml(input.html, accessible);
  let base: URL | null = null;
  try { base = new URL(input.url); } catch { /* unverified target */ }
  if (base && ['http:', 'https:'].includes(base.protocol) && !base.username && !base.password && !base.search && !base.hash) {
    for (const i of indicators) {
      const rule = COURT_RULES[i.id];
      if (!rule) continue;
      const seen = new Set<string>();
      for (const link of observed.links) {
        const u = publicLink(link.href, base);
        if (!u || !link.text || !rule.test(`${decodeURIComponent(u.pathname)} ${link.text}`) || seen.has(u.href)) continue;
        seen.add(u.href);
        i.evidence.push({ source: 'html', url: u.href, detail: `Tautan kandidat: ${link.text}. Isi, periode, dan kelengkapan belum diverifikasi.` });
        if (i.evidence.length >= 3) break;
      }
      if (i.evidence.length) {
        i.status = 'Sebagian'; i.checkMode = 'partial';
        i.note = 'Tautan kandidat teramati pada satu halaman. Bukan bukti isi, periode, kelengkapan, atau kepatuhan; buka dokumen dan verifikasi manual.';
      }
    }
  }
  const find = (id: string) => indicators.find(i => i.id === id);
  const partial = (ids: string[], source: ChecklistEvidence['source'], detail: string) => {
    if (!base || !['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) return;
    for (const id of ids) {
      const i = find(id); if (!i) continue;
      i.checkMode = 'partial'; i.status = 'Sebagian';
      i.evidence.push({source, url: base.href, detail});
      i.note = 'Bukti terbatas pada halaman/pengukuran ini, bukan pemenuhan seluruh indikator. Verifikasi manual tetap diperlukan.';
    }
  };
  const ts = input.technicalSignals; const ps = input.pageSpeed;
  const finite = (value: number | null, max = Number.MAX_SAFE_INTEGER): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
  if (accessible && base && ['http:', 'https:'].includes(base.protocol) && !base.username && !base.password && !base.search && !base.hash) {
    const https = find('https_ssl');
    if (https && ((base.protocol === 'https:' && ts.httpsValid === true) || (base.protocol === 'http:' && ts.httpsValid === false))) {
      const pass = base.protocol === 'https:';
      https.checkMode = 'automatic'; https.status = pass ? 'Terpenuhi' : 'Tidak Ditemukan'; https.score = pass ? 100 : 0;
      https.note = pass ? 'Koneksi HTTPS teramati berhasil pada URL ini; bukan sertifikasi keamanan situs.' : 'Respons sukses teramati melalui HTTP, bukan HTTPS pada URL ini; tidak menilai URL lain.';
      https.evidence.push({source:'headers',url:base.href,detail:`Skema ${base.protocol}; httpsValid=${ts.httpsValid}; HTTP ${ts.statusCode}.`});
    }
    if (ts.httpsValid || Object.values(ts.securityHeaders).some(Boolean)) partial(['security_headers','sec_https_headers'],'headers',`HTTPS teramati=${ts.httpsValid}; kehadiran header ${JSON.stringify(ts.securityHeaders)}. Kehadiran bukan validasi konfigurasi atau keamanan menyeluruh.`);
    if(observed.viewport) partial(['mobile_friendly','ui_responsive'],'html','Meta viewport teramati; tata letak, overflow, zoom, dan kenyamanan ponsel belum diperiksa.');
    if(finite(ts.responseTimeMs)) partial(['perf_assets'],'headers',`Waktu respons probe ${ts.responseTimeMs} ms; bukan ukuran gambar, efisiensi aset, atau Core Web Vitals.`);
    if(observed.title || observed.description) partial(['seo_metadata'],'html',`Metadata satu halaman: judul=${observed.title.slice(0,160)}; deskripsi=${observed.description.slice(0,200)}. Tidak membuktikan mutu atau semua halaman.`);
  }
  if (ps.source === 'pagespeed' || ps.source === 'lighthouse_local') {
    const timing = [['lcpMs',ps.lcpMs],['fcpMs',ps.fcpMs]].filter(([,value])=>finite(value as number | null));
    if(timing.length) partial(['perf_lcp_fcp','core_web_vitals'],'lighthouse',`${timing.map(([k,v])=>`${k}=${v} ms`).join('; ')}. Pengukuran lab satu halaman; bukan kelulusan Core Web Vitals lapangan.`);
    const stability = [['clsNum',ps.clsNum],['tbtMs',ps.tbtMs]].filter(([,value])=>finite(value as number | null));
    if(stability.length) partial(['perf_cls_tbt','core_web_vitals'],'lighthouse',`${stability.map(([k,v])=>`${k}=${v}`).join('; ')}. CLS/TBT lab bukan bukti seluruh pengalaman pengguna atau INP lapangan.`);
    if(finite(ps.accessibilityScore,100)) partial(['wcag_accessibility','a11y_wcag'],'lighthouse',`Skor pemeriksaan otomatis Lighthouse accessibility=${ps.accessibilityScore}/100; bukan kepatuhan WCAG atau uji alat bantu manual.`);
    if(finite(ps.seoScore,100)) partial(['seo_teknis'],'lighthouse',`Skor Lighthouse SEO=${ps.seoScore}/100; bukan bukti terindeks Google atau jaminan peringkat pencarian.`);
  }
  const statusCounts: Record<IndicatorStatus, number> = { Terpenuhi: 0, Sebagian: 0, 'Tidak Ditemukan': 0, 'Belum Diverifikasi': 0 };
  for (const i of indicators) statusCounts[i.status]++;
  return { pillarScores, checklistVersion: CHECKLIST_VERSION, checklistSummary: {
    total: indicators.length, automatic: indicators.filter(i => i.checkMode === 'automatic').length,
    partial: indicators.filter(i => i.checkMode === 'partial').length, manual: indicators.filter(i => i.checkMode === 'manual').length,
    withEvidence: indicators.filter(i => i.evidence.length > 0).length,
    coveragePercent: indicators.length ? Math.round(indicators.filter(i => i.evidence.length > 0).length * 10000 / indicators.length) / 100 : 0,
    statusCounts, ...(input.checkedAt ? { checkedAt: input.checkedAt } : {}),
  }};
}
