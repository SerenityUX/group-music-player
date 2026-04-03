import { useEffect, useRef, useState } from "react";
import SongSearchPanel from "./search/SongSearchPanel";

interface SearchModalProps {
  partyId: string;
  onClose: () => void;
}

const SHEET_MS = 320;
const DRAG_CLOSE_PX = 100;

export default function SearchModal({ partyId, onClose }: SearchModalProps) {
  const [open, setOpen] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const dragStartClientY = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function requestClose() {
    setDragging(false);
    setDragY(0);
    setOpen(false);
  }

  function handleSheetTransitionEnd(e: React.TransitionEvent<HTMLDivElement>) {
    if (e.target !== sheetRef.current) return;
    if (e.propertyName !== "transform") return;
    if (open) return;
    onClose();
  }

  function onHandlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setDragging(true);
    dragStartClientY.current = e.clientY;
  }

  function onHandlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    const dy = e.clientY - dragStartClientY.current;
    setDragY(Math.max(0, dy));
  }

  function onHandlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    draggingRef.current = false;
    setDragging(false);
    const y = e.clientY - dragStartClientY.current;
    const finalY = Math.max(0, y);
    if (finalY > DRAG_CLOSE_PX) {
      requestClose();
    } else {
      setDragY(0);
    }
  }

  const sheetTransform = !open ? "translateY(100%)" : `translateY(${dragY}px)`;

  return (
    <div className="fixed inset-0 z-[200]">
      <button
        type="button"
        className="absolute inset-0 bg-black ease-out"
        style={{
          opacity: open ? 0.4 : 0,
          transition: `opacity ${dragging ? 120 : SHEET_MS}ms ease-out`,
        }}
        aria-label="Close"
        onClick={requestClose}
      />

      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 z-[1] mx-auto flex max-h-[85vh] w-full max-w-[500px] flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl ${
          dragging ? "" : "transition-transform ease-out"
        }`}
        style={{
          transform: sheetTransform,
          transitionDuration: dragging ? "0ms" : `${SHEET_MS}ms`,
          minHeight: "min(45vh, 420px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        onTransitionEnd={handleSheetTransitionEnd}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none flex-col items-center justify-center py-3 active:cursor-grabbing"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
        >
          <div className="h-1.5 w-10 rounded-full bg-app-border" />
        </div>

        <SongSearchPanel partyId={partyId} variant="modal" />
      </div>
    </div>
  );
}
