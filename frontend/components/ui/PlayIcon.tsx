/** Selo de vídeo sobre a foto: círculo translúcido com triângulo. */
export function PlayIcon({ size = 34 }: { size?: 30 | 34 | 48 }) {
  const icon = size === 48 ? 16 : size === 34 ? 12 : 11;
  return (
    <span
      aria-hidden="true"
      className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: size === 48 ? "rgba(255,255,255,.3)" : "rgba(255,255,255,.35)" }}
    >
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill="#fff">
        <path d="M8 5l12 7-12 7z" />
      </svg>
    </span>
  );
}
