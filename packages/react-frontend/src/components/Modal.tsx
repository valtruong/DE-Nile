import { useEffect, useRef, type ReactNode } from "react";
import "./ui.css";

// A small accessible dialog: focuses its first control, closes
// on Escape or a click outside, and returns focus afterwards.
export function Modal({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Parents pass a new function each render; keep the latest
  // without re-running the focus effect below.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Focus the first control on open, Escape closes, and focus
  // goes back to the button that opened it.
  useEffect(() => {
    const previous =
      document.activeElement as HTMLElement | null;
    ref.current
      ?.querySelector<HTMLElement>(
        "input:checked, input, button.btn-primary, button"
      )
      ?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, []);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}>
      <div
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title">
        <h2 id="modal-title" className="modal-title">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
