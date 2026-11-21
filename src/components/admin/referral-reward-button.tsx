"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setReferralRewardStatusAction } from "@/app/admin/actions/referrals";
import { Button } from "@/components/ui/button";

export function ReferralRewardButton({ rewardId, status }: { rewardId: string; status: "available" | "cancelled" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await setReferralRewardStatusAction(rewardId, status === "available" ? "cancelled" : "available");
          if (r.ok) {
            toast.success(r.message ?? "Feito.");
            router.refresh();
          } else toast.error(r.error);
        })
      }
    >
      {status === "available" ? "Cancelar" : "Reativar"}
    </Button>
  );
}
