export function Avatar({ initials, size = 28 }: { initials: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className="grid shrink-0 place-items-center rounded-full bg-surface-2 font-semibold text-ink-2"
    >
      {initials}
    </span>
  );
}
