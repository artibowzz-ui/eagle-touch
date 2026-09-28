import type { ReactNode } from "react";

/* Device frame for real component previews. The screen inside uses the same tokens as the page. */
export function PhoneFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <figure
      aria-label={label}
      className="rounded-[44px] bg-[#0a0f0d] p-[9px] shadow-[0_40px_80px_-30px_rgb(10_24_18/0.55)] ring-1 ring-[#0a0f0d]/10"
    >
      <div className="overflow-hidden rounded-[35px] bg-surface">{children}</div>
    </figure>
  );
}
