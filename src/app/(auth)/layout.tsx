import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { MeshGradient } from '@/components/ui/mesh-gradient';
import { Wordmark } from '@/components/ui/wordmark';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-12">
      <MeshGradient colors={['blue', 'violet', 'pink']} />
      <Link href="/" className="relative mb-8 rounded-full px-2" aria-label="Miaamm">
        <Wordmark className="text-[30px]" />
      </Link>
      <Card className="relative w-full max-w-md p-6 sm:p-8">{children}</Card>
    </div>
  );
}
