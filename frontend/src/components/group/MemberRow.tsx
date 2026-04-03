import Pfp from "../Pfp";
import IconImg from "../ui/IconImg";

interface MemberRowProps {
  rank: number;
  name: string;
  peanutScore: number;
  isHost?: boolean;
  showRemove?: boolean;
  onRemove?: () => void;
}

export default function MemberRow({
  rank,
  name,
  peanutScore,
  isHost,
  showRemove,
  onRemove,
}: MemberRowProps) {
  return (
    <div className="flex items-center gap-3 border-b border-app-border py-3 last:border-0">
      <span className="w-6 text-sm text-neutral-500">{rank}.</span>
      <Pfp name={name} size={32} />
      <div className="flex min-h-0 min-w-0 flex-1 items-center gap-1">
        <span className="min-w-0 truncate font-medium">
          {name}
          {isHost && <span className="ml-2 text-xs text-neutral-400">host</span>}
        </span>
        {showRemove && onRemove && (
          <span className="shrink-0 text-sm font-normal text-neutral-500">
            (
            <button type="button" onClick={onRemove} className="text-red-600 underline">
              Remove
            </button>
            )
          </span>
        )}
      </div>
      <span className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums">
        <IconImg src="/icons/peanut.svg" className="h-4 w-4" />
        {peanutScore}
      </span>
    </div>
  );
}
