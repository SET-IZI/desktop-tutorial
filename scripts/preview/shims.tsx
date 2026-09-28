/** Remplacements de next/link et next/image pour l'aperçu hors Next.js. */
import { forwardRef } from 'react';

type AnchorProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export default forwardRef<HTMLAnchorElement, AnchorProps>(function PreviewLink(
  { href, onClick, ...props },
  ref,
) {
  return (
    <a
      ref={ref}
      href={href}
      {...props}
      onClick={(e) => {
        e.preventDefault();
        onClick?.(e);
        window.dispatchEvent(new CustomEvent('miaamm:preview-navigate', { detail: href }));
      }}
    />
  );
});

export function PreviewImage({
  src,
  alt,
  fill: _fill,
  sizes: _sizes,
  priority: _priority,
  ...props
}: {
  src: string;
  alt: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      {...props}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  );
}
