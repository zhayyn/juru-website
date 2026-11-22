import { DatabaseSync } from 'node:sqlite';
import { chmodSync, mkdirSync, lstatSync, openSync, closeSync, fchmodSync, constants } from 'node:fs';
import { dirname, isAbsolute, parse, join, normalize } from 'node:path';
import { homedir } from 'node:os';
import type { AuditReport, ImprovementAction } from '../src/types/audit.ts';

export interface AuditStorageResult { status: 'saved' | 'failed'; backend: 'sqlite'; message?: string }
export type StoredAuditReport = AuditReport & { storage: AuditStorageResult; improvementPlan?: ImprovementAction[] };
export interface AuditStore { save(report: AuditReport): AuditStorageResult; get(id: string): StoredAuditReport | null; close(): void }

export interface AuditStoreOptions { maxBytes?: number; ttlMs?: number; maxRecords?: number; now?: () => number }
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FAILED: AuditStorageResult = {status:'failed',backend:'sqlite',message:'Laporan tidak dapat disimpan.'};
const saved = (): AuditStorageResult => ({status:'saved',backend:'sqlite'});
function fail(): never { throw new Error('Laporan tidak valid.'); }
function safeUrl(value: unknown): boolean {
  if(typeof value !== 'string' || value.length>2048) return false;
  try {const u=new URL(value); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password && !u.search && !u.hash;} catch {return false;}
}
function canonical(value: unknown, limit: number): string {
  let bytes=0; let nodes=0; const seen=new Set<object>();
  function visit(v: unknown, depth: number, field = ''): unknown {
    if(++nodes>20000 || depth>24) fail();
    if(v===null || typeof v==='boolean') return v;
    if(typeof v==='number') {if(!Number.isFinite(v)) fail();return v;}
    if(typeof v==='string') {
      bytes+=Buffer.byteLength(v,'utf8');if(bytes>limit) fail();
      const instruction=field==='recommendation' || field==='verification';
      // Server-authored instructions contain example tags; probe/page markup is not report data.
      if (/<\/?[a-z][^>]*>/i.test(v) && (!instruction || /^\s*</.test(v) || /<!doctype|<\/(?:html|body|script|style)\s*>/i.test(v))) fail();
      if(/\b(?:Bearer\s+\S+|Basic\s+[A-Za-z0-9+/=]+)|(?:password|api[_-]?key|access[_-]?token|secret)\s*[:=]\s*\S+/i.test(v)) fail();
      for(const m of v.matchAll(/https?:\/\/[^\s"<>]+/gi)) if(!safeUrl(m[0])) fail();
      return v;
    }
    if(typeof v!=='object' || !v || seen.has(v)) fail();
    seen.add(v);
    let result: unknown;
    if(Array.isArray(v)) result=v.map(item=>visit(item,depth+1));
    else {
      if(![Object.prototype,null].includes(Object.getPrototypeOf(v))) fail();
      const out: Record<string,unknown>=Object.create(null);
      for(const key of Object.keys(v).sort()) {
        const d=Object.getOwnPropertyDescriptor(v,key)!; if(!('value' in d)) fail();
        if(/^(?:html|rawhtml|rawbody|body|credentials|password|passwd|authorization|cookie|setcookie|apikey|token|secret|accesstoken|refreshtoken|__proto__|prototype|constructor)$/i.test(key.replace(/[-_]/g,''))) fail();
        if(d.value!==undefined) out[key]=visit(d.value,depth+1,key);
      }
      result=out;
    }
    seen.delete(v);return result;
  }
  const text=JSON.stringify(visit(value,0)); if(!text || Buffer.byteLength(text,'utf8')>limit) fail();return text;
}
function validReport(r: any): void {
  if(!r || typeof r!=='object' || Array.isArray(r) || !ID.test(r.id ?? '') || !safeUrl(r.url)) fail();
  const allowed=new Set(['id','url','domain','siteName','category','strategy','auditedAt','totalScore','methodology','rankingEligible','rankingReason','measurementCoverage','aiStatus','grade','pillarScores','pageSpeed','technicalSignals','findings','executiveSummary','groundingSources','cloudSynced','cloudSyncError','storage','checklistVersion','checklistSummary','improvementPlan']);
  if(Object.keys(r).some(k=>!allowed.has(k))) fail();
  const text=(v:unknown)=>typeof v==='string';
  const num=(v:unknown,max=Number.MAX_SAFE_INTEGER)=>v===null || typeof v==='number' && Number.isFinite(v) && v>=0 && v<=max;
  for(const k of ['domain','siteName','auditedAt','grade','executiveSummary']) if(!text(r[k])) fail();
  if(!Number.isFinite(Date.parse(r.auditedAt)) || !['peradilan_agama','umum'].includes(r.category) || !['MOBILE','DESKTOP'].includes(r.strategy) || !num(r.totalScore,100) || typeof r.cloudSynced!=='boolean') fail();
  const p=r.pageSpeed,t=r.technicalSignals;
  if(!p || !t || !['pagespeed','lighthouse_local','server_probe'].includes(p.source)) fail();
  for(const k of ['performanceScore','accessibilityScore','bestPracticesScore','seoScore']) if(!num(p[k],100)) fail();
  for(const k of ['lcpMs','fcpMs','clsNum','tbtMs']) if(!num(p[k])) fail();
  for(const k of ['lcp','fcp','cls','tbt','speedIndex']) if(!text(p[k])) fail();
  for(const k of ['requestedUrl','finalUrl']) if(p[k]!==undefined && !safeUrl(p[k])) fail();
  if(typeof t.httpsValid!=='boolean' || typeof t.hasViewportMeta!=='boolean' || !(t.title===null || text(t.title)) || !num(t.responseTimeMs) || !(t.statusCode===null || Number.isInteger(t.statusCode) && t.statusCode>=100 && t.statusCode<=599)) fail();
  if(!t.securityHeaders || ['hsts','xFrameOptions','xContentTypeOptions','csp'].some(k=>typeof t.securityHeaders[k]!=='boolean')) fail();
  if(!Array.isArray(r.pillarScores) || !Array.isArray(r.findings) || !Array.isArray(r.groundingSources)) fail();
  for(const pillar of r.pillarScores) {
    if(!pillar || !text(pillar.id) || !text(pillar.name) || !text(pillar.summary) || typeof pillar.weight!=='number' || !num(pillar.weight,1) || !num(pillar.score,100) || !num(pillar.weightedContribution,100) || !Array.isArray(pillar.indicators)) fail();
    for(const i of pillar.indicators) {
      if(!i || !text(i.id) || !text(i.name) || !text(i.note) || !['Terpenuhi','Sebagian','Tidak Ditemukan','Belum Diverifikasi'].includes(i.status) || !num(i.score,100) || i.maxScore!==100) fail();
      if(i.checkMode!==undefined && !['automatic','partial','manual'].includes(i.checkMode)) fail();
      if(i.evidence!==undefined && (!Array.isArray(i.evidence) || i.evidence.some((e:any)=>!e || !['html','headers','lighthouse'].includes(e.source) || !safeUrl(e.url) || !text(e.detail)))) fail();
    }
  }
  for(const f of r.findings) if(!f || !text(f.area) || !text(f.issue) || !text(f.recommendation) || !['Tinggi','Sedang','Rendah'].includes(f.severity)) fail();
  for(const s of r.groundingSources) if(!s || !text(s.title) || !safeUrl(s.uri)) fail();
}

function preparePrivatePath(path: string): void {
  if(typeof path!=='string' || !isAbsolute(path) || path!==normalize(path) || path.includes('\0') || dirname(path)===parse(path).root || dirname(path)===homedir()) throw new Error('Jalur database tidak valid.');
  function inspect() {
    let current=parse(path).root;
    for(const part of path.slice(current.length).split('/')) {
      current=join(current,part);
      let info; try {info=lstatSync(current);} catch(error) {if((error as NodeJS.ErrnoException).code==='ENOENT') continue;throw error;}
      if(info.isSymbolicLink() || current===path && (!info.isFile() || info.nlink!==1) || current!==path && !info.isDirectory()) throw new Error('Jalur database tidak valid.');
    }
  }
  inspect();mkdirSync(dirname(path),{recursive:true,mode:0o700});inspect();
  chmodSync(dirname(path),0o700);
  const fd=openSync(path,constants.O_CREAT|constants.O_RDWR|constants.O_NOFOLLOW,0o600);
  try {fchmodSync(fd,0o600);} finally {closeSync(fd);}
}

/** Operator-only path. This module is not an HTTP authorization boundary. */
export function createAuditStore(databasePath: string, options: AuditStoreOptions = {}): AuditStore {
  const maxBytes=options.maxBytes ?? 512*1024;
  const ttlMs=options.ttlMs ?? 30*24*60*60*1000;
  const maxRecords=options.maxRecords ?? 1000;
  const now=options.now ?? Date.now;
  if(!Number.isSafeInteger(maxBytes) || maxBytes<1024 || maxBytes>2*1024*1024 || !Number.isSafeInteger(ttlMs) || ttlMs<1 || ttlMs>365*24*60*60*1000 || !Number.isSafeInteger(maxRecords) || maxRecords<1 || maxRecords>10000 || typeof now!=='function') throw new Error('Batas penyimpanan tidak valid.');
  const clock=()=>{const n=now();if(!Number.isSafeInteger(n) || n<0 || n>Number.MAX_SAFE_INTEGER-ttlMs) throw new Error('Waktu tidak valid.'); return n;};
  clock();
  let handle: DatabaseSync | undefined;
  try {
  preparePrivatePath(databasePath);
  const db=handle=new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=DELETE; PRAGMA secure_delete=ON; PRAGMA busy_timeout=1000; CREATE TABLE IF NOT EXISTS audits (id TEXT PRIMARY KEY, payload TEXT NOT NULL, inserted_at INTEGER NOT NULL, expires_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS audits_expires ON audits(expires_at)');
  const insert=db.prepare('INSERT INTO audits(id,payload,inserted_at,expires_at) VALUES (?,?,?,?)');
  const select=db.prepare('SELECT payload FROM audits WHERE id=?');
  const expire=db.prepare('DELETE FROM audits WHERE expires_at<=?');
  const cap=db.prepare('DELETE FROM audits WHERE id IN (SELECT id FROM audits ORDER BY inserted_at DESC, rowid DESC LIMIT -1 OFFSET ?)');
  function transaction<T>(work:()=>T):T {
    db.exec('BEGIN IMMEDIATE');
    try {const result=work();db.exec('COMMIT');return result;} catch(error) {try{db.exec('ROLLBACK');}catch{/* retain original failure */}throw error;}
  }
  const prune=(time:number)=>{expire.run(time);cap.run(maxRecords);};
  transaction(()=>prune(clock()));
  let closed=false;
  return {
    save(report) {
      try {
        if(closed) return {...FAILED};
        const clean=JSON.parse(canonical(report,maxBytes)); validReport(clean);
        clean.storage=saved(); const payload=canonical(clean,maxBytes);
        return transaction(()=>{
          const time=clock();prune(time);
          const prior=select.get(clean.id);
          if(prior) return prior.payload===payload ? saved() : {...FAILED};
          insert.run(clean.id,payload,time,time+ttlMs);cap.run(maxRecords);return saved();
        });
      } catch {return {...FAILED};}
    },
    get(id) {
      if(closed) throw new Error('Penyimpanan tidak tersedia.');
      if(typeof id!=='string' || !ID.test(id)) return null;
      try {return transaction(()=>{prune(clock());const row=select.get(id); if(!row) return null; const result=JSON.parse(String(row.payload)); validReport(result); return result as StoredAuditReport;});}
      catch {throw new Error('Penyimpanan tidak tersedia.');}
    },
    close() {if(!closed){db.close();closed=true;}},
  };
  } catch {try {handle?.close();} catch {/* preserve safe public error */}throw new Error('Penyimpanan tidak tersedia.');}
}
