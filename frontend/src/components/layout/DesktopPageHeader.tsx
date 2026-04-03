interface DesktopPageHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
}

/** Back (left) + centered title + invisible spacer (right) matching Back width. */
export default function DesktopPageHeader({ title, showBack = true, onBack }: DesktopPageHeaderProps) {
  const spacer = (
    <div className="invisible pointer-events-none select-none text-sm underline" aria-hidden>
      Back
    </div>
  );

  return (
    <div className="relative mb-6 flex items-center justify-between">
      {showBack ? (
        <button
          type="button"
          onClick={onBack}
          className="relative z-10 shrink-0 text-sm text-neutral-600 underline"
        >
          Back
        </button>
      ) : (
        spacer
      )}
      <h1 className="absolute left-1/2 top-1/2 max-w-[min(100%,14rem)] -translate-x-1/2 -translate-y-1/2 text-center text-2xl font-semibold tracking-tight text-neutral-900">
        {title}
      </h1>
      {spacer}
    </div>
  );
}
