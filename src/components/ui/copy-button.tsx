"use client";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";

export function CopyButton({ value, label = "Copiar link", ...props }: { value: string; label?: string } & ButtonProps) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Link copiado!");
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("Não foi possível copiar. Selecione e copie manualmente.");
        }
      }}
      {...props}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copiado" : label}
    </Button>
  );
}
