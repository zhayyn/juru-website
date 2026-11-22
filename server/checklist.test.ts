import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from './checklist.ts';
import { AUDIT_STANDARDS } from '../src/data/standards.ts';
import type { AuditCategory, PageSpeedMetrics, TechnicalSignals } from '../src/types/audit.ts';

export const signals: TechnicalSignals = { httpsValid: false, statusCode: null, title: null, hasViewportMeta: false, securityHeaders: { hsts: false, xFrameOptions: false, xContentTypeOptions: false, csp: false }, responseTimeMs: null };
export const metrics: PageSpeedMetrics = { performanceScore: null, accessibilityScore: null, bestPracticesScore: null, seoScore: null, lcp: '—', fcp: '—', cls: '—', tbt: '—', speedIndex: '—', lcpMs: null, fcpMs: null, clsNum: null, tbtMs: null, source: 'server_probe' };
const evaluate = (category: AuditCategory, html: string | null = null, extra = {}) => engine.evaluateAutomaticChecklist({ url: 'https://court.example/', category, html, technicalSignals: signals, pageSpeed: metrics, ...extra });
const flatten = (r: ReturnType<typeof evaluate>) => r.pillarScores.flatMap(p => p.indicators);

const indicator = (r: ReturnType<typeof evaluate>, id: string) => flatten(r).find(i=>i.id===id)!;

test('same-origin candidate documents are partial evidence, never compliance or absence', () => {
  const rows = [
    ['profil_struktur','struktur-organisasi'], ['lhkpn_lhkasn','lhkpn'], ['anggaran_dipa','dipa'],
    ['layanan_hukum','posbakum'], ['informasi_perkara','sipp'], ['panjar_biaya','panjar-biaya'],
    ['maklumat_pelayanan','maklumat-pelayanan'], ['pengaduan_siwas','pengaduan'], ['survei_skm_ipk','survei-kepuasan'],
  ];
  const html = '<body>'+rows.map(([id,path])=>`<a href="/dokumen/${path}.pdf">${path} tahun 2026</a>`).join('')+'</body>';
  const r = evaluate('peradilan_agama',html,{technicalSignals:{...signals,statusCode:200}});
  for (const [id,path] of rows) {
    const i=indicator(r,id); assert.equal(i.status,'Sebagian'); assert.equal(i.score,null); assert.equal(i.checkMode,'partial');
    assert.equal(i.evidence[0].url,`https://court.example/dokumen/${path}.pdf`); assert.match(i.evidence[0].detail,/2026/);
  }
  assert.equal(r.checklistSummary.withEvidence,9);
});

test('unobserved, inaccessible, or hidden keyword content never proves a document or absence', () => {
  const attempts = [null, '', '<body></body>', '<script><a href="/lhkpn.pdf">LHKPN</a></script>', '<style>.lhkpn {}</style><!--<a href="/lhkpn.pdf">LHKPN</a>-->', '<a href="https://evil.example/lhkpn.pdf">LHKPN</a>', '<a href="https://court.example.evil.example/lhkpn.pdf">LHKPN</a>', '<a href="/?q=lhkpn">LHKPN</a>', '<a href="/dokumen.pdf?token=x">LHKPN</a>', '<a href="/login/lhkpn">LHKPN</a>', '<div hidden><a href="/lhkpn.pdf">LHKPN</a></div>', '<template><a href="/lhkpn.pdf">LHKPN</a></template>', '<a href="/lhkpn.pdf" hidden>LHKPN</a>', '<a href="javascript:lhkpn()">LHKPN</a>', '<p>LHKPN tersedia</p>'];
  for (const html of attempts) {
    const i=indicator(evaluate('peradilan_agama',html,{technicalSignals:{...signals,statusCode:200}}),'lhkpn_lhkasn');
    assert.equal(i.status,'Belum Diverifikasi',String(html)); assert.equal(i.score,null); assert.deepEqual(i.evidence,[]);
  }
  assert.equal(indicator(evaluate('peradilan_agama','<a href="/lhkpn.pdf">LHKPN</a>',{technicalSignals:{...signals,statusCode:403}}),'lhkpn_lhkasn').status,'Belum Diverifikasi');
});

test('link extraction tolerates quoted > and HTML entities without reading scripts', () => {
  const html='<script>const x="LHKPN"</script><a title="dokumen > 1" href="/docs/lhkpn.pdf">LHKPN &amp; ASN</a>';
  const i=indicator(evaluate('peradilan_agama',html,{technicalSignals:{...signals,statusCode:200}}),'lhkpn_lhkasn');
  assert.equal(i.evidence[0]?.detail,'Tautan kandidat: LHKPN & ASN. Isi, periode, dan kelengkapan belum diverifikasi.');
});

test('HTTPS is bounded objective evidence only after a successful observed response', () => {
  for (const [url,httpsValid,score,status] of [['https://court.example/',true,100,'Terpenuhi'],['http://court.example/',false,0,'Tidak Ditemukan']] as const) {
    const r=evaluate('peradilan_agama',null,{url,technicalSignals:{...signals,statusCode:200,httpsValid}});
    const i=indicator(r,'https_ssl'); assert.equal(i.checkMode,'automatic'); assert.equal(i.score,score); assert.equal(i.status,status); assert.equal(i.evidence[0].source,'headers');
    assert.equal(r.pillarScores.at(-1)?.score,null);
  }
  assert.equal(indicator(evaluate('peradilan_agama',null,{technicalSignals:{...signals,httpsValid:true,statusCode:null}}),'https_ssl').score,null);
});

test('bounded metrics give partial evidence without broad composite or accessibility scores', () => {
  const ps={...metrics,source:'pagespeed',performanceScore:100,accessibilityScore:100,seoScore:100,lcpMs:1800,fcpMs:1000,clsNum:0.01,tbtMs:100};
  const ts={...signals,httpsValid:true,statusCode:200,hasViewportMeta:true,responseTimeMs:42,securityHeaders:{hsts:true,xFrameOptions:true,xContentTypeOptions:true,csp:true}};
  const r=evaluate('umum','<title>Public Site</title><meta name="description" content="Services"><meta name="viewport" content="width=device-width">',{technicalSignals:ts,pageSpeed:ps,checkedAt:'2026-11-21T00:00:00.000Z'});
  for(const id of ['perf_lcp_fcp','perf_cls_tbt','perf_assets','seo_metadata','ui_responsive','sec_https_headers','a11y_wcag']) {
    const i=indicator(r,id); assert.equal(i.status,'Sebagian',id); assert.equal(i.score,null); assert.equal(i.checkMode,'partial'); assert.ok(i.evidence.length>0);
  }
  for(const id of ['ui_navigation','seo_crawlability']) assert.equal(indicator(r,id).checkMode,'manual');
  assert.equal(r.checklistSummary.checkedAt,'2026-11-21T00:00:00.000Z');
  const court=evaluate('peradilan_agama',null,{technicalSignals:ts,pageSpeed:ps});
  for(const id of ['core_web_vitals','security_headers','seo_teknis','mobile_friendly','wcag_accessibility']) assert.equal(indicator(court,id).score,null);
  assert.equal(indicator(court,'wcag_accessibility').status,'Sebagian');
  assert.equal(indicator(court,'fitur_disabilitas').checkMode,'manual');
});

test('viewport evidence ignores raw probe flags, comments, scripts, hidden and invalid meta', () => {
  const ts={...signals,statusCode:200,hasViewportMeta:true};
  const meta='<meta name="viewport" content="width=device-width, initial-scale=1">';
  for (const [category,id] of [['umum','ui_responsive'],['peradilan_agama','mobile_friendly']] as const) {
    for (const html of [null,`<!-- ${meta} -->`,`<script>const sample='${meta}'</script>`,`<template>${meta}</template>`,`<div hidden>${meta}</div>`,'<meta name="viewport" content="initial-scale=1">']) {
      const i=indicator(evaluate(category,html,{technicalSignals:ts}),id);
      assert.equal(i.status,'Belum Diverifikasi',String(html)); assert.deepEqual(i.evidence,[]);
    }
    assert.equal(indicator(evaluate(category,meta,{technicalSignals:{...ts,hasViewportMeta:false}}),id).status,'Sebagian');
  }
});

test('missing and invalid metrics remain null and provider failure is not a zero score', () => {
  const r=evaluate('umum',null,{pageSpeed:{...metrics,source:'pagespeed',performanceScore:100,lcpMs:NaN,fcpMs:-1,clsNum:Infinity,tbtMs:null}});
  for(const id of ['perf_lcp_fcp','perf_cls_tbt','a11y_wcag']) {assert.equal(indicator(r,id).status,'Belum Diverifikasi'); assert.equal(indicator(r,id).score,null);}
  assert.ok(flatten(r).every(i=>i.score===null));
  const fallback=evaluate('umum',null,{pageSpeed:{...metrics,source:'server_probe',lcpMs:1000}});
  assert.equal(indicator(fallback,'perf_lcp_fcp').checkMode,'manual');
});

test('base href, malformed URL paths, oversized HTML, and encoded script markup fail closed', () => {
  const ts={...signals,statusCode:200};
  for(const html of ['<base href="https://evil.example/"><a href="/lhkpn.pdf">LHKPN</a>','<a href="/lhkpn%XX.pdf">LHKPN</a>','<a href="/lhkpn.pdf">LHKPN</a>'+'x'.repeat(1024*1024),'&lt;a href="/lhkpn.pdf"&gt;LHKPN&lt;/a&gt;']) {
    assert.doesNotThrow(()=>evaluate('peradilan_agama',html,{technicalSignals:ts}));
    assert.equal(indicator(evaluate('peradilan_agama',html,{technicalSignals:ts}),'lhkpn_lhkasn').status,'Belum Diverifikasi');
  }
});

test('title raw text and excessive nesting or token volume cannot fabricate link evidence', () => {
  const ts={...signals,statusCode:200};
  for(const html of ['<title><a href="/lhkpn.pdf">LHKPN</a></title>', '<div>'.repeat(129)+'<a href="/lhkpn.pdf">LHKPN</a>'+'</div>'.repeat(129),'<p>x</p>'.repeat(10001)+'<a href="/lhkpn.pdf">LHKPN</a>']) {
    const i=indicator(evaluate('peradilan_agama',html,{technicalSignals:ts}),'lhkpn_lhkasn');assert.equal(i.status,'Belum Diverifikasi');
  }
});

test('input measurements are never mutated, and repeated evidence is deterministic and bounded', () => {
  const ts={...signals,statusCode:200,httpsValid:true};const ps={...metrics};
  const before=JSON.stringify({ts,ps});const html='<a href="/lhkpn.pdf">LHKPN 2026</a>'.repeat(10);
  const a=evaluate('peradilan_agama',html,{technicalSignals:ts,pageSpeed:ps});
  assert.deepEqual(a,evaluate('peradilan_agama',html,{technicalSignals:ts,pageSpeed:ps}));
  assert.equal(JSON.stringify({ts,ps}),before);assert.equal(indicator(a,'lhkpn_lhkasn').evidence.length,1);
  assert.ok(a.checklistSummary.coveragePercent>=0 && a.checklistSummary.coveragePercent<=100);
  assert.equal(Object.values(a.checklistSummary.statusCounts).reduce((x,y)=>x+y,0),17);
  assert.equal(a.checklistSummary.automatic+a.checklistSummary.partial+a.checklistSummary.manual,17);
});

test('every catalogue ID is returned unverified when nothing was observed', () => {
  for (const category of ['peradilan_agama', 'umum'] as const) {
    const r = evaluate(category);
    assert.deepEqual(r.pillarScores.map(p => ({id:p.id, name:p.name, weight:p.weight, ids:p.indicators.map(i => i.id)})), AUDIT_STANDARDS[category].pillars.map(p => ({id:p.id, name:p.name, weight:p.weight, ids:p.indicators.map(i=>i.id)})));
    assert.ok(flatten(r).every(i=>i.status === 'Belum Diverifikasi' && i.score === null && i.checkMode === 'manual' && i.ruleVersion === r.checklistVersion && i.evidence.length === 0));
    assert.ok(r.pillarScores.every(p=>p.score === null && p.weightedContribution === null));
    assert.equal(r.checklistSummary.total, flatten(r).length);
    assert.equal(r.checklistSummary.coveragePercent, 0);
    assert.deepEqual(evaluate(category), r);
  }
});
