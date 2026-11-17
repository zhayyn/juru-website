import { type ReactNode, useId, useState } from 'react';

interface HoverTipProps {
  children: ReactNode;
  description: string;
  align?: 'left' | 'center' | 'right';
  placement?: 'top' | 'bottom';
  className?: string;
}

/**
 * Menampilkan keterangan tambahan secara halus saat judul disorot (hover),
 * difokuskan dengan keyboard, atau diketuk pada perangkat sentuh.
 */
export function HoverTip({
  children,
  description,
  align = 'left',
  placement = 'top',
  className = '',
}: HoverTipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipId = useId();

  const alignClasses =
    align === 'right'
      ? 'right-0'
      : align === 'center'
        ? 'left-1/2 -translate-x-1/2'
        : 'left-0';

  const placementClasses =
    placement === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2';

  return (
    <span
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <span
        tabIndex={0}
        aria-describedby={isOpen ? tooltipId : undefined}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onClick={(e) => {
          // Mendukung ketukan cepat di perangkat sentuh tanpa mengganggu klik tombol induk
          if (e.currentTarget === e.target) {
            setIsOpen((prev) => !prev);
          }
        }}
        className="cursor-help decoration-slate-300 underline-offset-4 hover:underline focus:outline-none dark:decoration-slate-600"
      >
        {children}
      </span>

      <span
        id={tooltipId}
        role="tooltip"
        aria-hidden={!isOpen}
        className={`print:hidden pointer-events-none absolute z-40 w-64 max-w-[80vw] rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-normal leading-relaxed tracking-normal text-slate-700 shadow-lg transition-all duration-150 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 ${placementClasses} ${alignClasses} ${
          isOpen
            ? 'translate-y-0 opacity-100'
            : 'invisible translate-y-1 opacity-0'
        }`}
      >
        {description}
      </span>
    </span>
  );
}
