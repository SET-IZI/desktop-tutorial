import type { KeyboardCoordinateGetter } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

/**
 * Déplacement clavier d'un cran par flèche dans une liste verticale.
 * sortableKeyboardCoordinates se base sur la géométrie et bloque quand les éléments
 * ont des hauteurs différentes (catégories plus ou moins longues) : ici on vise
 * l'élément voisin dans l'ordre et on aligne le bord correspondant.
 */
export const listKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const dir = event.code === 'ArrowUp' ? -1 : event.code === 'ArrowDown' ? 1 : 0;
  if (dir === 0) return sortableKeyboardCoordinates(event, args);
  const { over, collisionRect, droppableRects, droppableContainers } = args.context;
  if (!collisionRect) return undefined;
  event.preventDefault();

  const ordered = droppableContainers
    .getEnabled()
    .flatMap((c) => {
      const rect = droppableRects.get(c.id);
      return rect ? [{ id: c.id, rect }] : [];
    })
    .sort((a, b) => a.rect.top - b.rect.top);
  const index = ordered.findIndex((c) => c.id === (over?.id ?? args.active));
  const target = ordered[index + dir];
  if (index < 0 || !target) return undefined;

  const dy =
    dir < 0 ? target.rect.top - collisionRect.top : target.rect.bottom - collisionRect.bottom;
  return { x: args.currentCoordinates.x, y: args.currentCoordinates.y + dy };
};
