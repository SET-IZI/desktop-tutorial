'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { completeHours } from '@/app/app/onboarding/actions';
import { HoursEditor } from '@/components/admin/hours-editor';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import type { WeekSchedule } from '@/lib/admin/schedule';

export function HoursStep({ schedule }: { schedule: WeekSchedule }) {
  const t = useTranslations('onboarding.hours');
  const ta = useTranslations('admin');
  const router = useRouter();
  const toast = useToast();

  return (
    <div className="space-y-4">
      <Card className="p-5 sm:p-7">
        <h2 className="text-[22px] font-bold tracking-display">{t('title')}</h2>
        <p className="mt-1 text-fg-muted">{t('hint')}</p>
      </Card>
      <HoursEditor
        schedules={{ pickup: schedule, delivery: {} }}
        closures={[]}
        canManage
        deliveryEnabled={false}
        showClosures={false}
        saveLabel={t('submit')}
        onSaved={async () => {
          const result = await completeHours();
          if (!result.ok) {
            toast(ta('saveError'), 'error');
            return;
          }
          router.push('/app/onboarding');
          router.refresh();
        }}
      />
    </div>
  );
}
