"use client";
import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { removeClientPhotoAction, uploadClientPhotoAction } from "@/app/admin/actions/clients";
import { Button } from "@/components/ui/button";

/** Foto da cliente na ficha (guardada em área privada; exibida por link temporário). */
export function ClientPhoto({ clientId, name, url, canEdit }: { clientId: string; name: string; url: string | null; canEdit: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center gap-4">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- link temporário do Storage
        <img src={url} alt={`Foto de ${name}`} className="size-20 shrink-0 rounded-full border-2 border-champagne/60 object-cover" data-testid="client-photo" />
      ) : (
        <span className="grid size-20 shrink-0 place-items-center rounded-full bg-cream font-display text-3xl text-gold-dark">{name.charAt(0)}</span>
      )}
      {canEdit ? (
        <div className="flex flex-col gap-1.5">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            data-testid="client-photo-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const fd = new FormData();
              fd.set("clientId", clientId);
              fd.set("file", file);
              start(async () => {
                const r = await uploadClientPhotoAction(fd);
                if (r.ok) {
                  toast.success(r.message ?? "Foto salva.");
                  router.refresh();
                } else toast.error(r.error);
              });
            }}
          />
          <Button size="sm" variant="outline" disabled={pending} onClick={() => input.current?.click()}>
            {pending ? <Loader2 className="animate-spin" /> : <Camera />} {url ? "Trocar foto" : "Adicionar foto"}
          </Button>
          {url ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                confirm("Remover a foto desta cliente?") &&
                start(async () => {
                  const r = await removeClientPhotoAction(clientId);
                  if (r.ok) {
                    toast.success(r.message ?? "Foto removida.");
                    router.refresh();
                  } else toast.error(r.error);
                })
              }
            >
              <Trash2 /> Remover foto
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
