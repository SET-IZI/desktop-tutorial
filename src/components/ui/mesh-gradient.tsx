import { cn } from '@/lib/utils';

type Tone = 'blue' | 'violet' | 'pink' | 'orange' | 'green';

interface MeshGradientProps {
  className?: string;
  /** Couleurs des taches, dans l'ordre. 3 ou 4 conseillées. */
  colors?: Tone[];
}

const POSITIONS = [
  'left-[-10%] top-[-20%]',
  'right-[-15%] top-[-10%]',
  'bottom-[-25%] left-[20%]',
  'bottom-[-20%] right-[5%]',
];

const TONE: Record<Tone, string> = {
  blue: 'bg-blue',
  violet: 'bg-violet',
  pink: 'bg-pink',
  orange: 'bg-orange',
  green: 'bg-green',
};

/** Fond mesh gradient doux, animé lentement (figé si reduced-motion). Décoratif. */
export function MeshGradient({
  className,
  colors = ['orange', 'pink', 'violet', 'blue'],
}: MeshGradientProps) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {colors.slice(0, 4).map((tone, i) => (
        <div
          key={`${tone}-${i}`}
          className={cn(
            'absolute size-[60vmax] animate-mesh-drift rounded-full opacity-30 blur-[100px] dark:opacity-25',
            TONE[tone],
            POSITIONS[i],
          )}
          style={{ animationDelay: `${i * -6}s` }}
        />
      ))}
    </div>
  );
}
