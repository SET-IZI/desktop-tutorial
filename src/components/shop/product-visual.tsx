import Image from 'next/image';
import type { Tone } from '@/lib/storefront/types';
import { cn } from '@/lib/utils';

const GRADIENT: Record<Tone, string> = {
  blue: 'from-blue/25 to-violet/20',
  violet: 'from-violet/25 to-pink/20',
  pink: 'from-pink/25 to-orange/20',
  orange: 'from-orange/30 to-pink/20',
  green: 'from-green/25 to-blue/15',
};

interface ProductVisualProps {
  imageUrl?: string;
  alt: string;
  tone: Tone;
  emoji: string | null;
  className?: string;
  sizes: string;
  priority?: boolean;
}

/** Photo du plat, ou dégradé de la couleur de catégorie + emoji si pas de photo. */
export function ProductVisual({
  imageUrl,
  alt,
  tone,
  emoji,
  className,
  sizes,
  priority,
}: ProductVisualProps) {
  return (
    <div className={cn('relative overflow-hidden bg-gradient-to-br', GRADIENT[tone], className)}>
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : emoji ? (
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center text-[2.5em]"
        >
          {emoji}
        </span>
      ) : null}
    </div>
  );
}
