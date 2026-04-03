import type { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
  className?: string;
  /** Desktop card border color override (e.g. audio-reactive) */
  cardBorderColor?: string;
}

/**
 * Mobile: full-width column (max 500px). Desktop (md+): centered card 600×430 max,
 * 12px radius, border — content scrolls inside if needed.
 */
export default function PageShell({ children, className = "", cardBorderColor }: PageShellProps) {
  return (
    <div
      className="min-h-dvh bg-white text-neutral-900 md:bg-app-surface"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div
        className={`mx-auto flex min-h-dvh w-full max-w-[500px] flex-col px-4 pt-4 md:max-w-none md:w-full md:justify-center md:px-4 ${className}`}
      >
        <div className="flex flex-1 flex-col md:min-h-0 md:items-center md:justify-center md:py-4">
          <div
            className="relative z-10 flex w-full flex-1 flex-col md:max-h-[430px] md:min-h-[430px] md:max-w-[600px] md:overflow-hidden md:rounded-[12px] md:border md:bg-white"
            style={cardBorderColor ? { borderColor: cardBorderColor } : { borderColor: "#A9A9A9" }}
          >
            <div className="flex flex-1 flex-col max-md:min-h-full md:min-h-0 md:overflow-y-auto md:px-4 md:pb-4 md:pt-4">
              <div className="flex flex-1 flex-col max-md:min-h-full md:min-h-full">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
