import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

interface HoverTipProps {
  children: ReactNode;
  description: string;
  align?: 'left' | 'center' | 'right';
  placement?: 'top' | 'bottom';
  className?: string;
  /** Inside an existing control: its parent owns focus and aria-description. */
  passive?: boolean;
}

/** Supplementary text only. Important errors and provenance remain visible. */
export function HoverTip({ children, description, align = 'left', placement = 'top', className = '', passive = false }: HoverTipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipId = useId();
  const wrapper = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!passive) return;
    const control = wrapper.current?.closest('button');
    const focus = () => { if (control?.matches(':focus-visible')) setIsOpen(true); };
    const blur = () => setIsOpen(false);
    const activate = () => setIsOpen(true);
    control?.addEventListener('focus', focus);
    control?.addEventListener('blur', blur);
    control?.addEventListener('click', activate);
    return () => {
      control?.removeEventListener('focus', focus);
      control?.removeEventListener('blur', blur);
      control?.removeEventListener('click', activate);
    };
  }, [passive]);
  useEffect(() => {
    if (!isOpen) return;
    const outside = (event: PointerEvent) => { if (!wrapper.current?.contains(event.target as Node)) setIsOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [isOpen]);
  return (
    <span ref={wrapper} className={`hover-tip ${className}`} data-align={align} data-placement={placement}
      onPointerEnter={event => { if (event.pointerType !== 'touch') setIsOpen(true); }}
      onPointerLeave={event => {
        const focusRoot = passive ? wrapper.current?.closest('button') : event.currentTarget;
        if (event.pointerType !== 'touch' && !focusRoot?.contains(document.activeElement)) setIsOpen(false);
      }}>
      <span data-tip-trigger="true" role={passive ? undefined : 'button'} tabIndex={passive ? undefined : 0}
        aria-describedby={tooltipId} aria-expanded={passive ? undefined : isOpen}
        onFocus={event => { if (event.currentTarget.matches(':focus-visible')) setIsOpen(true); }}
        onBlur={event => { if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) setIsOpen(false); }}
        onClick={passive ? undefined : () => setIsOpen(true)}
        onKeyDown={passive ? undefined : event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setIsOpen(value => !value); } }}
        className="tip-trigger">
        {children}
      </span>
      <span id={tooltipId} role="tooltip" hidden={!isOpen} className="tip-content print:hidden">{description}</span>
    </span>
  );
}
