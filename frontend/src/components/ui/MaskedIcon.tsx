interface MaskedIconProps {
  /** e.g. `/icons/clap.svg` — assets live in `public/icons/` */
  src: string;
  className?: string;
  /** Solid fill behind the mask (default: selected-state green) */
  color?: string;
}

/** Renders a public SVG as a solid color (e.g. brand green) via CSS mask — use when `<img>` + filter is too imprecise. */
export default function MaskedIcon({
  src,
  className = "h-6 w-6",
  color = "#00CB5B",
}: MaskedIconProps) {
  return (
    <span
      className={`inline-block shrink-0 ${className}`}
      style={{
        backgroundColor: color,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
      aria-hidden
    />
  );
}
