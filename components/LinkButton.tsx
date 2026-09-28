import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "accent" | "outlineOnForest";

const styles: Record<Variant, string> = {
  primary: "bg-forest text-on-forest hover:bg-forest-2",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-2",
  accent: "bg-accent text-on-accent hover:brightness-105",
  outlineOnForest: "border border-on-forest/35 text-on-forest hover:bg-on-forest/10",
};

export function LinkButton({
  href,
  children,
  variant = "primary",
  size = "md",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  size?: "sm" | "md";
  className?: string;
}) {
  const sizing = size === "sm" ? "h-10 px-4 text-sm" : "h-12 px-5 text-[15px]";
  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-[background-color,transform,filter] duration-200 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${sizing} ${styles[variant]} ${className}`}
    >
      {children}
    </a>
  );
}
