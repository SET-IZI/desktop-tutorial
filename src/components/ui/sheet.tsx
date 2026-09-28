'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useState } from 'react';
import { useMediaQuery } from '@/hooks/use-media-query';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface SheetState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SheetContext = createContext<SheetState | null>(null);

function useSheet(): SheetState {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error('<SheetContent> doit être dans <Sheet>.');
  return ctx;
}

interface SheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

/** Bottom-sheet Liquid Glass sur mobile, fenêtre centrée à partir de 640 px. */
export function Sheet({
  open: controlled,
  defaultOpen = false,
  onOpenChange,
  children,
}: SheetProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = controlled ?? uncontrolled;
  const setOpen = useCallback(
    (next: boolean) => {
      if (controlled === undefined) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );

  return (
    <SheetContext.Provider value={{ open, setOpen }}>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        {children}
      </Dialog.Root>
    </SheetContext.Provider>
  );
}

export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

interface SheetContentProps {
  title: string;
  /** Titre masqué visuellement (reste lu par les lecteurs d'écran). */
  hideTitle?: boolean;
  description?: string;
  className?: string;
  children?: React.ReactNode;
  closeLabel?: string;
}

const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 600;

export function SheetContent({
  title,
  hideTitle,
  description,
  className,
  children,
  closeLabel = 'Fermer',
}: SheetContentProps) {
  const { open, setOpen } = useSheet();
  const isDesktop = useMediaQuery('(min-width: 640px)');
  const dragControls = useDragControls();

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) setOpen(false);
  };

  const motionProps = isDesktop
    ? {
        initial: { opacity: 0, scale: 0.96 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.96 },
      }
    : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } };

  return (
    <AnimatePresence>
      {open ? (
        <Dialog.Portal forceMount>
          <Dialog.Overlay asChild forceMount>
            <motion.div
              className="fixed inset-0 z-50 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          </Dialog.Overlay>
          <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
            <Dialog.Content
              asChild
              forceMount
              {...(description ? {} : { 'aria-describedby': undefined })}
            >
              <motion.div
                {...motionProps}
                transition={spring}
                drag={isDesktop ? false : 'y'}
                dragControls={dragControls}
                dragListener={false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.6 }}
                onDragEnd={onDragEnd}
                className={cn(
                  'glass pointer-events-auto relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-bento-lg shadow-float sm:max-w-lg sm:rounded-bento-lg',
                  className,
                )}
              >
                {!isDesktop ? (
                  <div
                    className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
                    onPointerDown={(e) => dragControls.start(e)}
                    aria-hidden
                  >
                    <span className="h-1.5 w-10 rounded-full bg-fg/20" />
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-2 sm:pt-6">
                  <div>
                    <Dialog.Title
                      className={cn(
                        'text-[24px] font-bold tracking-display',
                        hideTitle && 'sr-only',
                      )}
                    >
                      {title}
                    </Dialog.Title>
                    {description ? (
                      <Dialog.Description className="mt-1 text-fg-muted">
                        {description}
                      </Dialog.Description>
                    ) : null}
                  </div>
                  <Dialog.Close
                    className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-fg/[0.06] text-fg transition-colors hover:bg-fg/10"
                    aria-label={closeLabel}
                  >
                    <X className="size-5" aria-hidden />
                  </Dialog.Close>
                </div>
                <div className="overflow-y-auto overscroll-contain px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                  {children}
                </div>
              </motion.div>
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      ) : null}
    </AnimatePresence>
  );
}
