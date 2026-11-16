"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Loader2, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { anonymizeClientAction, deleteClientAction, setClientBlockedAction } from "@/app/admin/actions/clients";
import { ClientForm } from "@/components/admin/client-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import type { Client } from "@/lib/types";

const CONFIRM_WORD = "APAGAR";

export function ClientProfileActions({ client, isOwner, hasHistory }: { client: Client; isOwner: boolean; hasHistory: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [eraseOpen, setEraseOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [blockOpen, setBlockOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const blocked = Boolean(client.blocked_at);

  const toggleBlock = (value: boolean) =>
    start(async () => {
      const r = await setClientBlockedAction(client.id, value, reason);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Feito.");
      setBlockOpen(false);
      setReason("");
      router.refresh();
    });

  const erase = () =>
    start(async () => {
      const r = hasHistory ? await anonymizeClientAction(client.id) : await deleteClientAction(client.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Dados apagados.");
      setEraseOpen(false);
      setTyped("");
      if (hasHistory) router.refresh();
      else router.push("/admin/clientes");
    });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil /> Editar
      </Button>
      {isOwner ? (
        blocked ? (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => toggleBlock(false)} data-testid="desbloquear-cliente">
            <ShieldCheck /> Desbloquear
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setBlockOpen(true)} data-testid="bloquear-cliente">
            <Ban /> Bloquear
          </Button>
        )
      ) : null}
      {isOwner ? (
        <Button variant="ghost" size="sm" className="text-rose-700 hover:bg-rose-50" onClick={() => setEraseOpen(true)} data-testid="apagar-cliente">
          <Trash2 /> Apagar dados da cliente
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Editar cliente">
          <ClientForm client={client} onSaved={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent title="Bloquear cliente" description="Use em situações de problema ou inconveniência.">
          <div className="space-y-4 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-ink/80">
            <p>
              <b>{client.full_name}</b> não conseguirá mais agendar pelo site (pelo mesmo WhatsApp ou e-mail). Ela verá apenas a mensagem
              &ldquo;Não foi possível concluir o agendamento online. Por favor, fale com o studio pelo WhatsApp.&rdquo;
            </p>
            <p className="rounded-2xl bg-ivory p-3 text-[13px] text-muted">
              Os dados e o histórico continuam no painel, e você ainda pode agendá-la manualmente se quiser. Dá para desbloquear a qualquer
              momento.
            </p>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-ink/80">Motivo (anotação interna, opcional)</span>
              <Textarea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="bloqueio-motivo" />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setBlockOpen(false)}>
                Cancelar
              </Button>
              <Button variant="danger" disabled={pending} onClick={() => toggleBlock(true)} data-testid="bloqueio-confirmar">
                {pending ? <Loader2 className="animate-spin" /> : <Ban />} Bloquear cliente
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={eraseOpen}
        onOpenChange={(v) => {
          setEraseOpen(v);
          if (!v) setTyped("");
        }}
      >
        <DialogContent title="Apagar dados da cliente" description="Use quando a cliente pedir a exclusão dos dados dela (LGPD).">
          <div className="space-y-4 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-ink/80">
            {hasHistory ? (
              <>
                <p>
                  Serão apagados <b>nome, WhatsApp, e-mail, aniversário, observações e a autorização de novidades</b> de{" "}
                  <b>{client.full_name}</b>. As mensagens que ela escreveu nos agendamentos e o destinatário dos envios também são apagados.
                </p>
                <p className="rounded-2xl bg-ivory p-3 text-[13px] text-muted">
                  O histórico de atendimentos e valores continua no sistema (sem identificar a cliente), porque é necessário para o controle
                  financeiro. Ela aparecerá como &ldquo;Cliente anonimizada&rdquo;.
                </p>
              </>
            ) : (
              <p>
                <b>{client.full_name}</b> não tem atendimentos registrados. O cadastro será <b>excluído por completo</b>.
              </p>
            )}
            <p className="font-medium text-rose-700">Esta ação não pode ser desfeita.</p>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-ink/80">
                Para confirmar, digite <b className="font-mono">{CONFIRM_WORD}</b>
              </span>
              <Input value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} autoComplete="off" data-testid="apagar-confirmacao" />
            </label>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setEraseOpen(false)}>
                Cancelar
              </Button>
              <Button variant="danger" disabled={typed !== CONFIRM_WORD || pending} onClick={erase} data-testid="apagar-confirmar">
                {pending ? <Loader2 className="animate-spin" /> : <Trash2 />} Apagar dados
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
