import { getPfpBackgroundColorForName } from "../lib/pfpLetterColor";
import MaskedIcon from "./ui/MaskedIcon";

interface PfpProps {
  name: string;
  size?: number;
  /** Small badge icon (e.g. clap / shit) */
  reactionIconSrc?: string | null;
  /** Badge diameter in px; defaults to scaling with `size` */
  reactionBadgePx?: number;
  /** Animate in from 0×0 scale */
  animate?: boolean;
}

/** Initials avatar: rainbow-by-letter background (WCAG contrast with white text) + optional reaction badge. */
export default function Pfp({ name, size = 48, reactionIconSrc, reactionBadgePx, animate = false }: PfpProps) {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  const badgeSize = reactionBadgePx ?? size * 0.45;
  const backgroundColor = getPfpBackgroundColorForName(name);

  return (
    <div
      className={`relative shrink-0 ${animate ? "animate-[pfpScaleIn_0.25s_ease-out_both]" : ""}`}
      style={{ width: size, height: size }}
    >
      <div
        className="flex items-center justify-center rounded-full font-semibold text-white select-none"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.45,
          backgroundColor,
        }}
        role="img"
        aria-label={name}
      >
        {letter}
      </div>
      {reactionIconSrc && (
        <div
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border border-app-mediumGreen bg-app-lightGreen shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
          style={{
            width: badgeSize,
            height: badgeSize,
          }}
        >
          <MaskedIcon src={reactionIconSrc} className="h-[55%] w-[55%]" />
        </div>
      )}
    </div>
  );
}
