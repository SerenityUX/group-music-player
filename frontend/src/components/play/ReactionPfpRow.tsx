import Pfp from "../Pfp";

export interface ReactionItem {
  name: string;
  reaction_type: string;
}

interface ReactionPfpRowProps {
  reactions: ReactionItem[];
  /** Avatar diameter in px (default 40) */
  avatarSize?: number;
  /** Clap/shit bubble size in px; omit to scale with avatar */
  reactionBadgePx?: number;
  /** e.g. justify-center for desktop host column */
  justify?: "start" | "center";
}

export default function ReactionPfpRow({
  reactions,
  avatarSize = 40,
  reactionBadgePx,
  justify = "start",
}: ReactionPfpRowProps) {
  if (reactions.length === 0) return null;

  const justifyCls = justify === "center" ? "justify-center" : "justify-start";

  return (
    <div className={`flex flex-wrap gap-1.5 py-1 ${justifyCls}`}>
      {reactions.map((r, i) => (
        <Pfp
          key={`${r.name}-${i}`}
          name={r.name}
          size={avatarSize}
          reactionBadgePx={reactionBadgePx}
          reactionIconSrc={r.reaction_type === "Claps" ? "/icons/clap.svg" : "/icons/shit.svg"}
          animate
        />
      ))}
    </div>
  );
}
