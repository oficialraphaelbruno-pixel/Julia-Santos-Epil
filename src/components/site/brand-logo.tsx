import Image from "next/image";
import { cn } from "@/lib/utils";

/** Logomarca oficial (proporção preservada). */
export function BrandLogo({
  src,
  name,
  className,
  priority,
  sizes = "200px",
}: {
  src: string | null;
  name: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  if (!src) {
    return <span className={cn("font-display text-xl text-gold-dark", className)}>{name}</span>;
  }
  return (
    <span className={cn("relative block", className)}>
      <Image src={src} alt={`Logomarca ${name}`} fill sizes={sizes} priority={priority} className="object-contain" />
    </span>
  );
}
