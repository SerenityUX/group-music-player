/** Placeholder layout matching NowPlayingCard while idle (no current track). */

interface NowPlayingCardSkeletonProps {
  compact?: boolean;
  desktopHost?: boolean;
}

export default function NowPlayingCardSkeleton({ compact, desktopHost }: NowPlayingCardSkeletonProps) {
  const block = "animate-pulse rounded-md bg-app-skeleton";

  if (desktopHost) {
    return (
      <div className="flex min-h-[11rem] w-full flex-col items-center px-1">
        <div className="aspect-square w-full max-w-[min(100%,11rem)] shrink-0 animate-pulse rounded-lg bg-app-skeleton" />
        <div className="mt-1.5 w-full max-w-[min(100%,11rem)] space-y-2">
          <div className={`mx-auto h-4 w-[88%] ${block}`} />
          <div className={`mx-auto h-3 w-[55%] ${block}`} />
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 animate-pulse rounded-lg bg-app-skeleton" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className={`h-5 w-[88%] max-w-[220px] ${block}`} />
          <div className={`h-4 w-[60%] max-w-[160px] ${block}`} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto aspect-square w-full max-w-[312px] animate-pulse rounded-lg bg-app-skeleton" />
      <div className="mx-auto mt-4 max-w-[312px] space-y-2.5 px-1">
        <div className={`mx-auto h-7 w-[85%] ${block}`} />
        <div className={`mx-auto h-4 w-[55%] ${block}`} />
      </div>
    </div>
  );
}
