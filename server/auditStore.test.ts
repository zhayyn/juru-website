import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync, mkdirSync, writeFileSync, symlinkSync, chmodSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import * as storeModule from './auditStore.ts';
import { evaluateAutomaticChecklist } from './checklist.ts';
import { buildMeasuredReport } from './report.ts';
import { buildImprovementPlan } from '../src/utils/recommendations.ts';
import type { AuditReport } from '../src/types/audit.ts';
const ROOT=resolve(process.env.JURU_AUDIT_TEST_ROOT ?? join(homedir(),'.hermes/cache/scratch/juru-audit-tests'));
mkdirSync(ROOT,{recursive:true,mode:0o700});
const uuid=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function fixture(n=1): AuditReport {
  return {id:uuid(n),url:'https://court.example/',domain:'court.example',siteName:'Court',category:'peradilan_agama',strategy:'MOBILE',auditedAt:'2026-11-21T00:00:00.000Z',totalScore:null,grade:'Belum lengkap',pillarScores:[],
    pageSpeed:{performanceScore:null,accessibilityScore:null,bestPracticesScore:null,seoScore:null,lcp:'—',fcp:'—',cls:'—',tbt:'—',speedIndex:'—',lcpMs:null,fcpMs:null,clsNum:null,tbtMs:null,source:'server_probe'},
    technicalSignals:{httpsValid:true,statusCode:200,title:'Court',hasViewportMeta:false,securityHeaders:{hsts:false,xFrameOptions:false,xContentTypeOptions:false,csp:false},responseTimeMs:20},
    findings:[],executiveSummary:'Pengukuran satu halaman, bukan kepatuhan resmi.',groundingSources:[{title:'Halaman',uri:'https://court.example/'}],cloudSynced:false};
}
function databasePath() {return join(mkdtempSync(join(ROOT,'store-')),'private','audits.sqlite');}

test('duplicate IDs are canonical and idempotent, conflicting reports never replace originals', () => {
  const path=databasePath(); const store=storeModule.createAuditStore(path); const report=fixture();
  assert.equal(store.save(report).status,'saved');
  const reversed=Object.fromEntries(Object.entries(report).reverse()) as unknown as AuditReport;
  assert.equal(store.save(reversed).status,'saved');
  assert.equal(store.save({...report,siteName:'Conflicting report'}).status,'failed');
  assert.equal(store.get(report.id)?.siteName,'Court'); store.close();
  const db=new DatabaseSync(path); const payload=String(db.prepare('SELECT payload FROM audits').get()?.payload);
  assert.ok(payload.startsWith('{"auditedAt":')); assert.equal(db.prepare('SELECT COUNT(*) AS n FROM audits').get()?.n,1); db.close();
});

test('invalid IDs, malformed reports, nonfinite numbers, unsafe URLs and private fields are rejected', () => {
  const store=storeModule.createAuditStore(databasePath());
  for(const id of ['', '../file', "x' OR 1=1--",'x'.repeat(1000)]) {assert.equal(store.save({...fixture(),id}).status,'failed'); assert.equal(store.get(id),null);}
  const bad: unknown[]=[null,{},[],{...fixture(),totalScore:101},{...fixture(),pageSpeed:{...fixture().pageSpeed,lcpMs:NaN}},
    {...fixture(),url:'https://user:password@court.example/'},{...fixture(),url:'https://court.example/?token=private'},
    {...fixture(),html:'<html>private</html>'},{...fixture(),credentials:{password:'private'}},{...fixture(),executiveSummary:'Authorization: Bearer private-secret'},
    {...fixture(),executiveSummary:'<script>private</script>'},{...fixture(),technicalSignals:{...fixture().technicalSignals,statusCode:'200'}}];
  const circular:any=fixture(); circular.self=circular;bad.push(circular);
  for(const report of bad) assert.equal(store.save(report as AuditReport).status,'failed');
  assert.equal(store.get(uuid(1)),null);
  assert.equal(store.save(fixture(2)).status,'saved'); store.close();
});

test('byte limits and lifecycle failures return safe errors without paths or SQL', () => {
  const store=storeModule.createAuditStore(databasePath(),{maxBytes:4096});
  assert.equal(store.save({...fixture(),executiveSummary:'é'.repeat(4096)}).status,'failed');
  assert.equal(store.save(fixture()).status,'saved'); store.close();
  const result=store.save(fixture(2)); assert.equal(result.status,'failed'); assert.doesNotMatch(result.message ?? '',/sqlite|INSERT|fixtures|\//i);
  assert.throws(()=>store.get(uuid(1)),/Penyimpanan tidak tersedia/);
});

test('TTL expires at the boundary without refreshing duplicate insertion age', () => {
  let now=1000; const path=databasePath(); const options={ttlMs:100,maxRecords:10,now:()=>now};
  let store=storeModule.createAuditStore(path,options);
  assert.equal(store.save(fixture()).status,'saved');now=1099;assert.equal(store.save(fixture()).status,'saved');
  assert.ok(store.get(uuid(1))); store.close(); now=1100;
  store=storeModule.createAuditStore(path,options);assert.equal(store.get(uuid(1)),null);store.close();
  const db=new DatabaseSync(path);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM audits').get()?.n,0);db.close();
});

test('record cap evicts oldest insertion deterministically while keeping the newest report', () => {
  let now=1000; const path=databasePath(); const store=storeModule.createAuditStore(path,{maxRecords:2,now:()=>now});
  store.save(fixture(1));now++;store.save(fixture(2));now++;store.save(fixture(3));
  assert.equal(store.get(uuid(1)),null);assert.ok(store.get(uuid(2)));assert.ok(store.get(uuid(3)));store.close();
  const db=new DatabaseSync(path);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM audits').get()?.n,2);db.close();
});

test('failed SQLite insert rolls back pruning and never returns saved', () => {
  let now=1000; const path=databasePath();const store=storeModule.createAuditStore(path,{ttlMs:100,maxRecords:1,now:()=>now});
  store.save(fixture(1));
  const db=new DatabaseSync(path);db.exec("CREATE TRIGGER fail_insert BEFORE INSERT ON audits BEGIN SELECT RAISE(ABORT, 'blocked'); END");
  now=1100; assert.equal(store.save(fixture(2)).status,'failed');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM audits').get()?.n,1);db.close();store.close();
});

test('unsafe filesystem paths, symlinks and invalid options fail before touching the target', () => {
  const root=mkdtempSync(join(ROOT,'paths-'));const target=join(root,'target.sqlite');writeFileSync(target,'sentinel',{mode:0o644});
  const link=join(root,'link.sqlite');symlinkSync(target,link);
  assert.throws(()=>storeModule.createAuditStore(link),/Penyimpanan tidak tersedia|Jalur database tidak valid/);
  assert.equal(readFileSync(target,'utf8'),'sentinel');assert.equal(statSync(target).mode & 0o777,0o644);
  const dir=join(root,'target-dir');mkdirSync(dir);symlinkSync(dir,join(root,'linked-dir'));
  assert.throws(()=>storeModule.createAuditStore(join(root,'linked-dir','audit.sqlite')),/Penyimpanan tidak tersedia|Jalur database tidak valid/);
  for(const path of ['relative.sqlite',':memory:','/audits.sqlite',root]) assert.throws(()=>storeModule.createAuditStore(path));
  for(const options of [{maxRecords:0},{ttlMs:0},{maxBytes:1},{maxRecords:10001},{ttlMs:Infinity},{now:()=>NaN}]) assert.throws(()=>storeModule.createAuditStore(databasePath(),options));
  assert.throws(()=>storeModule.createAuditStore(target),/Penyimpanan tidak tersedia/);
});

test('existing private database and directory permissions are tightened', () => {
  const path=databasePath();let store=storeModule.createAuditStore(path);store.save(fixture());store.close();
  chmodSync(path,0o644);chmodSync(join(path,'..'),0o755);
  store=storeModule.createAuditStore(path);assert.equal(statSync(path).mode & 0o777,0o600);assert.equal(statSync(join(path,'..')).mode & 0o777,0o700);assert.ok(store.get(uuid(1)));store.close();
});

test('complete checklist evidence is retained as report JSON without raw HTML or credentials', () => {
  const r=fixture();const html='<a href="/dokumen/lhkpn.pdf">LHKPN 2026</a>';
  const checklist=evaluateAutomaticChecklist({url:r.url,category:r.category,html,technicalSignals:r.technicalSignals,pageSpeed:r.pageSpeed});
  const report={...r,...checklist};const path=databasePath();const store=storeModule.createAuditStore(path);
  assert.equal(store.save(report).status,'saved');assert.deepEqual(store.get(r.id),{...report,storage:{status:'saved',backend:'sqlite'}});store.close();
  assert.ok(!readFileSync(path).includes(Buffer.from('<a href=')));
});

test('expired rows are removed during reads and reduced caps are applied on reopen', () => {
  let now=1000;const path=databasePath();let store=storeModule.createAuditStore(path,{ttlMs:100,now:()=>now});
  store.save(fixture(1));store.save(fixture(2));store.save(fixture(3));store.close();
  store=storeModule.createAuditStore(path,{maxRecords:1,ttlMs:100,now:()=>now});assert.equal(store.get(uuid(1)),null);assert.equal(store.get(uuid(2)),null);assert.ok(store.get(uuid(3)));
  now=1100;assert.equal(store.get(uuid(3)),null);store.close();
});

test('instructional markup snippets in deterministic recommendations do not drop complete reports', () => {
  const report={...fixture(),improvementPlan:[{id:'technical-viewport',area:'Tampilan ponsel',severity:'Sedang',source:'Pengukuran',issue:'Viewport belum terdeteksi',recommendation:'Tambahkan <meta name="viewport" content="width=device-width"> dan <main> untuk konten.',verification:'Periksa atribut lang pada <html lang="id">, bukan source HTML lengkap.'}]};
  const store=storeModule.createAuditStore(databasePath());assert.equal(store.save(report).status,'saved');assert.deepEqual(store.get(report.id)?.improvementPlan,report.improvementPlan);store.close();
});

test('server-generated full recommendations persist when modern landmark checks fail', () => {
  for (const category of ['peradilan_agama','umum'] as const) {
    const f=fixture();
    const report=buildMeasuredReport({url:f.url,category,strategy:'MOBILE',html:'<html><title>Court</title></html>',pageSpeed:f.pageSpeed,
      technicalSignals:{...f.technicalSignals,modernWeb:{hasLangAttribute:false,hasMainLandmark:false,hasColorSchemeMeta:false,unverifiedExternalAssets:2,prefixedMaskWithoutStandard:true}}});
    const full={...report,improvementPlan:buildImprovementPlan(report)};
    assert.ok(full.improvementPlan.some(i=>i.id==='modern-main' && /main/.test(i.issue)));
    const path=databasePath();let store=storeModule.createAuditStore(path);
    try {assert.equal(store.save(full).status,'saved');} finally {store.close();}
    store=storeModule.createAuditStore(path);
    try {assert.deepEqual(store.get(report.id)?.improvementPlan,full.improvementPlan);} finally {store.close();}
  }
});

test('real SQLite report survives close and reopen with full nulls and metadata', () => {
  const path=databasePath(); const report={...fixture(),checklistVersion:'automatic-checklist-v1',checklistSummary:{total:0,automatic:0,partial:0,manual:0,withEvidence:0,coveragePercent:0,statusCounts:{Terpenuhi:0,Sebagian:0,'Tidak Ditemukan':0,'Belum Diverifikasi':0}},improvementPlan:[]};
  let store=storeModule.createAuditStore(path);
  assert.equal(store.get(uuid(99)),null); assert.equal('list' in store,false);
  assert.deepEqual(store.save(report),{status:'saved',backend:'sqlite'});
  store.close(); store.close();
  store=storeModule.createAuditStore(path);
  assert.deepEqual(store.get(report.id),{...report,storage:{status:'saved',backend:'sqlite'}});
  assert.equal(statSync(path).mode & 0o777,0o600);
  assert.equal(statSync(join(path,'..')).mode & 0o777,0o700);
  store.close();
  assert.equal(readFileSync(path).subarray(0,16).toString(),'SQLite format 3\0');
  const db=new DatabaseSync(path); assert.equal(db.prepare('SELECT COUNT(*) AS n FROM audits').get()?.n,1); db.close();
});
