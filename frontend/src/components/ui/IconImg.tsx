interface IconImgProps {
  /** e.g. `/icons/MusicIcon.svg` — assets live in `public/icons/` */
  src: string;
  alt?: string;
  className?: string;
}

export default function IconImg({ src, alt = "", className = "h-6 w-6" }: IconImgProps) {
  return <img src={src} alt={alt} className={`object-contain ${className}`} />;
}
