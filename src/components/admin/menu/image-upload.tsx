'use client';

import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/browser';

const MAX_SIDE = 1600;
const MAX_BYTES = 5 * 1024 * 1024;

/** Redimensionne dans le navigateur (1600 px max) et convertit en WebP (JPEG en repli). */
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  const webp = await toBlob('image/webp');
  if (webp && webp.type === 'image/webp') return webp;
  const jpeg = await toBlob('image/jpeg');
  if (!jpeg) throw new Error('encode');
  return jpeg;
}

interface ImageUploadProps {
  restaurantId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  alt: string;
}

/** Photo du plat : envoi direct vers Supabase Storage (bucket « menu », dossier du restaurant). */
export function ImageUpload({ restaurantId, value, onChange, alt }: ImageUploadProps) {
  const t = useTranslations('menuEditor.product');
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(false);

  const upload = async (file: File) => {
    setError(false);
    setUploading(true);
    try {
      const blob = await compress(file);
      if (blob.size > MAX_BYTES) throw new Error('too_large');
      const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${restaurantId}/${crypto.randomUUID()}.${ext}`;
      const storage = createClient().storage.from('menu');
      const { error: uploadError } = await storage.upload(path, blob, {
        contentType: blob.type,
        cacheControl: '31536000',
      });
      if (uploadError) throw uploadError;
      onChange(storage.getPublicUrl(path).data.publicUrl);
    } catch {
      setError(true);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <p className="font-semibold">{t('photo')}</p>
      <div className="flex items-center gap-4">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-[20px] bg-fg/[0.06]">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu local, déjà compressé
            <img src={value} alt={alt} className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-fg-muted">
              <ImagePlus className="size-7" aria-hidden />
            </span>
          )}
          {uploading ? (
            <span className="absolute inset-0 flex items-center justify-center bg-bg/60">
              <Loader2 className="size-6 animate-spin" aria-hidden />
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <Button asChild variant="secondary" size="sm">
            <label htmlFor={inputId} className="cursor-pointer">
              {value ? t('changePhoto') : t('addPhoto')}
            </label>
          </Button>
          {value ? (
            <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
              <Trash2 className="size-4" aria-hidden />
              {t('removePhoto')}
            </Button>
          ) : null}
        </div>
      </div>
      <p aria-live="polite" className="text-[14px]">
        {uploading ? <span className="text-fg-muted">{t('uploading')}</span> : null}
        {error ? (
          <span className="font-medium text-[#C00011] dark:text-red">{t('photoError')}</span>
        ) : null}
      </p>
    </div>
  );
}
