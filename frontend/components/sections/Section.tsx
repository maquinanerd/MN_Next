import type { ReactNode } from "react";

/** Seção da home/editoria: 56px de margem + divisor + 48px de respiro (36px de margem no mobile). */
export function Section({
  children,
  className = "",
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={`mt-14 border-t border-mn-line pt-12 mob:mt-9 ${className}`}
    >
      {children}
    </section>
  );
}
