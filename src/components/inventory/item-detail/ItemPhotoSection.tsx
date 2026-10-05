import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchItems } from "@/lib/inventory";
import { ItemPhoto, PHOTO_BUCKET } from "@/components/inventory/ItemPhoto";
import { Button } from "@/components/ui/button";

export type ItemPhotoSectionProps = { itemId: string };

export function ItemPhotoSection({ itemId }: ItemPhotoSectionProps) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: fetchItems });
  const item = items.find((candidate) => candidate.id === itemId);

  const savePhoto = useMutation({
    mutationFn: async (photoUrl: string) => {
      const { error } = await supabase.from("items").update({ photo_url: photoUrl }).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("Item atualizado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function uploadPhoto(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${itemId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file);
      if (error) throw error;
      await savePhoto.mutateAsync(path);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no envio da foto");
    } finally {
      setUploading(false);
    }
  }

  if (!item) return null;

  return (
    <div className="space-y-3">
      <ItemPhoto path={item.photo_url} alt={item.name} className="aspect-square w-full" />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadPhoto(file);
        }}
      />
      <Button variant="outline" className="w-full" disabled={uploading} onClick={() => fileRef.current?.click()}>
        <Upload className="size-4" />
        {uploading ? "Enviando..." : "Trocar foto"}
      </Button>
    </div>
  );
}