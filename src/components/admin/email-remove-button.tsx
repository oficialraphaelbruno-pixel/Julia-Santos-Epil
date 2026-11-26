"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserMinus } from "lucide-react";
import { removeFromEmailListAction } from "@/app/admin/actions/emails";
import { Button } from "@/components/ui/button";

export function EmailRemoveButton({ email }: { email: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={`Tirar ${email} da lista`}
      title="Tirar da lista de novidades"
      disabled={pending}
      data-testid="email-remover"
      onClick={() => {
        if (!confirm(`Tirar ${email} da lista de novidades? O cadastro e o histórico continuam.`)) return;
        start(async () => {
          const r = await removeFromEmailListAction(email);
          if (r.ok) {
            toast.success(r.message ?? "Removido.");
            router.refresh();
          } else toast.error(r.error);
        });
      }}
    >
      <UserMinus />
    </Button>
  );
}
