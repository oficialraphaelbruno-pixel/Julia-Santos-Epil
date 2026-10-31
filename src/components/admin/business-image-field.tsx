"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveBusinessImageAction } from "@/app/admin/actions/settings";
import { ImageUpload } from "@/components/admin/image-upload";

export function BusinessImageField({
  field,
  value,
  label,
  description,
  aspect,
  fit,
  canEdit,
}: {
  field: "logo_url" | "photo_url" | "cover_url";
  value: string | null;
  label: string;
  description?: string;
  aspect?: string;
  fit?: "cover" | "contain";
  canEdit: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(value);
  const [, start] = useTransition();
  return (
    <div>
      <p className="text-[15px] font-medium text-ink">{label}</p>
      {description ? <p className="mb-3 text-[13px] text-muted">{description}</p> : null}
      {canEdit ? (
        <ImageUpload
          value={current}
          kind={field.replace("_url", "")}
          aspect={aspect}
          fit={fit}
          onChange={(url) =>
            start(async () => {
              const r = await saveBusinessImageAction(field, url);
              if (r.ok) {
                setCurrent(url);
                toast.success(r.message ?? "Imagem atualizada.");
                router.refresh();
              } else toast.error(r.error);
            })
          }
        />
      ) : (
        <p className="text-sm text-muted">Somente a proprietária pode alterar.</p>
      )}
    </div>
  );
}
