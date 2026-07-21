import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type TooltipProps = {
  content: string;
  children: ReactNode;
  focusable?: boolean;
};

type TooltipPosition = {
  left: number;
  top: number;
};

export function Tooltip({ content, children, focusable = true }: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      setPosition({
        left: Math.min(Math.max(rect.left + rect.width / 2, 72), window.innerWidth - 72),
        top: Math.min(rect.bottom + 8, window.innerHeight - 42),
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  return (
    <>
      <span
        className="app-tooltip__trigger"
        ref={triggerRef}
        tabIndex={focusable ? 0 : undefined}
        aria-describedby={isOpen ? tooltipId : undefined}
        onPointerEnter={() => setIsOpen(true)}
        onPointerLeave={() => setIsOpen(false)}
        onFocus={focusable ? () => setIsOpen(true) : undefined}
        onBlur={focusable ? () => setIsOpen(false) : undefined}
        onKeyDown={(event) => {
          if (focusable && event.key === 'Escape') {
            setIsOpen(false);
            event.currentTarget.blur();
          }
        }}
      >
        {children}
      </span>
      {isOpen && position !== null && typeof document !== 'undefined'
        ? createPortal(
            <span
              className="app-tooltip"
              id={tooltipId}
              role="tooltip"
              style={{ left: position.left, top: position.top }}
            >
              {content}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
