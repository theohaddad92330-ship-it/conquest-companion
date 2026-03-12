import logo from "@/assets/bellum-logo.png";
import { cn } from "@/lib/utils";

export function BellumLogo({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={logo}
      alt="Bellum"
      width={size}
      height={size}
      className={cn(
        "rounded-xl object-cover shadow-sm ring-1 ring-border/60",
        className
      )}
      loading="eager"
      decoding="async"
    />
  );
}

