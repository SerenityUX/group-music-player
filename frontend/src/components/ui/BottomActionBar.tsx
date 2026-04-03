import type { ReactNode } from "react";

interface BottomActionBarProps {
  children: ReactNode;
}

/** Sticky-style bar for primary actions (Continue / Create Group) */
export default function BottomActionBar({ children }: BottomActionBarProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[60] border-t border-app-border bg-white/95 px-4 pt-4 backdrop-blur-sm"
      style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="mx-auto w-full max-w-[500px]">{children}</div>
    </div>
  );
}
