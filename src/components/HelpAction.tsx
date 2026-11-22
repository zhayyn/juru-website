import { useEffect, useId, useRef, useState } from 'react';
import type { AuditFinding } from '../types/audit';

export function buildHelpUrl(domain: string, area: string): string {
  const clean = (text: string, limit: number) => text.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, limit);
  const text = `Halo, saya ingin konsultasi perbaikan website ${clean(domain, 253)}, bagian ${clean(area, 120)}. Mohon tinjau bukti audit dan informasikan ruang lingkup serta biayanya sebelum pekerjaan dimulai.`;
  return `https://wa.me/6281317361689?text=${encodeURIComponent(text)}`;
}

interface Props {
  domain: string;
  area: string;
  severity: AuditFinding['severity'];
  issue?: string;
  recommendation?: string;
  verification?: string;
  source?: string;
}

/** Interactive disclosure: hover/focus/tap reveals help; only a link click opens WhatsApp. */
export function HelpAction({ domain, area, severity, issue, recommendation, verification, source }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (root.current?.contains(document.activeElement)) root.current.querySelector<HTMLButtonElement>('.action-trigger')?.focus();
        setOpen(false);
      }
    };
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', escape); document.removeEventListener('pointerdown', outside); };
  }, [open]);
  return <div ref={root} className="help-action" data-priority={severity.toLowerCase()}
    onPointerEnter={event => { if (event.pointerType !== 'touch') setOpen(true); }}
    onPointerLeave={event => { if (event.pointerType !== 'touch' && !event.currentTarget.contains(document.activeElement)) setOpen(false); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button type="button" className="action-trigger" aria-expanded={open} aria-controls={id}
      onFocus={event => { if (event.currentTarget.matches(':focus-visible')) setOpen(true); }}
      onClick={() => setOpen(true)}>
      <span>{area}</span><span className="priority-label">Prioritas {severity}</span>
    </button>
    <div id={id} hidden={!open} className="help-panel print:hidden" role="region" aria-label={`Detail dan bantuan: ${area}`}>
      {source && <p className="help-source">{source}</p>}
      {issue && <p>{issue}</p>}
      {recommendation && <p><strong>Saran perbaikan</strong><br />{recommendation}</p>}
      {verification && <p><strong>Cara Verifikasi</strong><br />{verification}</p>}
      <a className="help-whatsapp" href={buildHelpUrl(domain, area)} target="_blank" rel="noopener noreferrer">Minta bantuan via WhatsApp ↗</a>
      <p className="help-privacy">Membuka draft pesan ke 0813 1736 1689; tidak mengirim otomatis. Nomor dan percakapan diproses WhatsApp setelah Anda membukanya. Biaya disepakati terpisah.</p>
      <button type="button" className="help-close" onClick={() => { root.current?.querySelector<HTMLButtonElement>('.action-trigger')?.focus(); setOpen(false); }}>Tutup detail</button>
    </div>
    <div className="action-print-note hidden print:block">{source && <p>{source}</p>}<p>{issue}</p><p>{recommendation}</p><p>Cara Verifikasi: {verification}</p></div>
  </div>;
}
