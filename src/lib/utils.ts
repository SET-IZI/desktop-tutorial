import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge doit connaître les tokens custom (tailwind.config.ts), sinon il prend
 * `text-body` pour une couleur et supprime `text-cta-fg`, par exemple.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['body', 'display-sm', 'display-md', 'display-lg', 'display-xl'] }],
      rounded: [{ rounded: ['bento', 'bento-sm', 'bento-lg'] }],
      'rounded-t': [{ 'rounded-t': ['bento', 'bento-sm', 'bento-lg'] }],
      shadow: [{ shadow: ['soft', 'float'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
