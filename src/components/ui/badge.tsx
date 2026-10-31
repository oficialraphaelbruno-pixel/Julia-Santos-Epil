import { cn } from "@/lib/utils";
import { STATUS_LABEL, STATUS_STYLE, type AppointmentStatus } from "@/lib/constants";

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge className={STATUS_STYLE[status]}>{STATUS_LABEL[status]}</Badge>;
}
