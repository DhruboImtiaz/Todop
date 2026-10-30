import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './PickerPopover.css';

interface PickerPopoverProps {
  id?: string;
  kind: 'date' | 'time';
  value: string;
  icon: ReactNode;
  disabled?: boolean;
  onOpen: () => void;
  onConfirm: () => void;
  canConfirm?: boolean;
  footerStart?: ReactNode;
  children: ReactNode;
}

/** Shared positioning, dismissal and focus behavior for scheduling pickers. */
export function PickerPopover({
  id, kind, value, icon, disabled, onOpen, onConfirm, canConfirm = true, footerStart, children,
}: PickerPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const dialogId = useId();
  const label = `Select ${kind}`;
  const close = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const popover = popoverRef.current;
    const trigger = triggerRef.current;
    if (!popover || !trigger) return;
    const updatePosition = () => {
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const rect = trigger.getBoundingClientRect();
      const width = popover.offsetWidth;
      const height = popover.offsetHeight;
      const bottom = viewportTop + viewportHeight - 16;
      const below = rect.bottom + 8;
      const top = below + height <= bottom ? below : rect.top - height - 8;
      setStyle({
        '--picker-top': `${Math.max(viewportTop + 16, Math.min(top, bottom - height))}px`,
        '--picker-left': `${Math.max(viewportLeft + 16, Math.min(rect.left, viewportLeft + viewportWidth - width - 16))}px`,
        '--viewport-top': `${viewportTop}px`,
        '--viewport-left': `${viewportLeft}px`,
        '--viewport-height': `${viewportHeight}px`,
        '--viewport-width': `${viewportWidth}px`,
      } as CSSProperties);
    };
    const focusable = () => Array.from(popover.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [tabindex="0"]',
    )).filter(element => element.getClientRects().length > 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      } else if (event.key === 'Tab') {
        const elements = focusable();
        const first = elements[0];
        const last = elements.at(-1);
        if (event.shiftKey && (document.activeElement === first || !popover.contains(document.activeElement))) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !popover.contains(document.activeElement))) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!popover.contains(event.target as Node) && !trigger.contains(event.target as Node)) close();
    };
    updatePosition();
    const selected = popover.querySelector<HTMLElement>('[aria-selected="true"], [aria-pressed="true"]');
    (selected ?? focusable()[0])?.focus({ preventScroll: true });
    const observer = new ResizeObserver(updatePosition);
    observer.observe(popover);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.visualViewport?.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('scroll', updatePosition);
    // Capture Escape before the parent form can discard its draft.
    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.visualViewport?.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('scroll', updatePosition);
      window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [isOpen, close]);

  return (
    <div className={`picker-container ${kind}-picker-container`}>
      <button
        id={id} ref={triggerRef} type="button" disabled={disabled}
        className={`picker-trigger ${kind}-picker-trigger form-input`}
        aria-label={label} aria-haspopup="dialog" aria-expanded={isOpen}
        aria-controls={isOpen ? dialogId : undefined}
        onClick={() => {
          if (isOpen) close();
          else { onOpen(); setIsOpen(true); }
        }}
      >
        <span>{value || label}</span>{icon}
      </button>
      {isOpen && createPortal(
        <>
          <div className="picker-backdrop" aria-hidden="true" />
          <div id={dialogId} ref={popoverRef} className={`picker-popover ${kind}-picker-popover`}
            style={style} role="dialog" aria-modal="true" aria-label={label}>
            {children}
            <div className="picker-footer">
              {footerStart}
              <div className="picker-footer-actions">
                <button type="button" className="picker-footer-btn" onClick={close}>Cancel</button>
                <button type="button" className="picker-footer-btn picker-confirm" disabled={!canConfirm}
                  onClick={() => { onConfirm(); close(); }}>OK</button>
              </div>
            </div>
          </div>
        </>, document.body,
      )}
    </div>
  );
}
