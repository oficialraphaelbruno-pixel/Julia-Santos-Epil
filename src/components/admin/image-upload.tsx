"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { uploadImageAction } from "@/app/admin/actions/uploads";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ImageUpload({
  value,
  onChange,
  kind,
  aspect = "aspect-[4/3]",
  fit = "cover",
  label = "Enviar imagem",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  kind: string;
  aspect?: string;
  fit?: "cover" | "contain";
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  return (
    <div className="flex items-center gap-4">
      <div className={cn("relative w-32 shrink-0 overflow-hidden rounded-xl border border-line bg-ivory", aspect)}>
        {value ? (
          <Image src={value} alt="" fill sizes="128px" className={fit === "cover" ? "object-cover" : "object-contain p-2"} />
        ) : (
          <div className="grid h-full place-items-center text-gold/60">
            <ImagePlus className="size-6" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploading(true);
            const fd = new FormData();
            fd.append("file", file);
            fd.append("kind", kind);
            const res = await uploadImageAction(fd);
            setUploading(false);
            e.target.value = "";
            if (res.ok && res.data) onChange(res.data.url);
            else if (!res.ok) toast.error(res.error);
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => input.current?.click()}>
          {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />} {value ? "Trocar" : label}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <Trash2 /> Remover
          </Button>
        ) : null}
        <p className="text-[11px] text-muted">PNG, JPG ou WEBP · até 5 MB</p>
      </div>
    </div>
  );
}
