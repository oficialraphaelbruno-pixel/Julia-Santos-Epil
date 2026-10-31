"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, ShieldOff, Trash2 } from "lucide-react";
import { anonymizeClientAction, deleteClientAction } from "@/app/admin/actions/clients";
import { ClientForm } from "@/components/admin/client-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Client } from "@/lib/types";

export function ClientProfileActions({ client, isOwner, hasHistory }: { client: Client; isOwner: boolean; hasHistory: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil /> Editar
      </Button>
      {isOwner ? (
        hasHistory ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              confirm("Anonimizar os dados pessoais desta cliente? O histórico de atendimentos e valores é mantido, mas nome, WhatsApp, e-mail e observações serão apagados. Esta ação não pode ser desfeita.") &&
              start(async () => {
                const r = await anonymizeClientAction(client.id);
                if (r.ok) {
                  toast.success(r.message ?? "Feito.");
                  router.refresh();
                } else toast.error(r.error);
              })
            }
          >
            <ShieldOff /> Anonimizar dados
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              confirm("Excluir esta cliente?") &&
              start(async () => {
                const r = await deleteClientAction(client.id);
                if (r.ok) {
                  toast.success("Cliente excluída.");
                  router.push("/admin/clientes");
                } else toast.error(r.error);
              })
            }
          >
            <Trash2 /> Excluir
          </Button>
        )
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Editar cliente">
          <ClientForm client={client} onSaved={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
