"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { sendTestEmailAction, sendTestWhatsappAction } from "@/app/admin/actions/integrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TestSender({ kind, defaultValue }: { kind: "email" | "whatsapp"; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        type={kind === "email" ? "email" : "tel"}
        placeholder={kind === "email" ? "seu-email@exemplo.com" : "(31) 99999-9999"}
        aria-label={kind === "email" ? "E-mail para teste" : "WhatsApp para teste"}
        className="sm:max-w-xs"
      />
      <Button
        variant="outline"
        className="h-11"
        disabled={pending || !value}
        onClick={() =>
          start(async () => {
            const r = kind === "email" ? await sendTestEmailAction(value) : await sendTestWhatsappAction(value);
            if (r.ok) toast.success(r.message ?? "Enviado.");
            else toast.error(r.error);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Send />} Enviar teste
      </Button>
    </div>
  );
}
