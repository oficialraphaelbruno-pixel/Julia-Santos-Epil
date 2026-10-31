import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-champagne/50 bg-white/60 px-6 py-12 text-center", className)}>
      {icon ? <div className="mb-4 grid size-12 place-items-center rounded-full bg-cream text-gold [&_svg]:size-5">{icon}</div> : null}
      <p className="font-display text-lg text-ink">{title}</p>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
