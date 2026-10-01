'use client';

import { Copy, Trash2, UserPlus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import {
  changeRole,
  inviteMember,
  removeMember,
  revokeInvite,
} from '@/app/app/(shell)/equipe/actions';
import { Field, inputClass } from '@/components/onboarding/field';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { useToast } from '@/components/ui/toast';
import type { MemberRole } from '@/lib/auth/session';

interface TeamManagerProps {
  isOwner: boolean;
  currentUserId: string;
  /** URL absolue de la page « rejoindre », à compléter par le jeton. */
  inviteBase: string;
  members: { userId: string; email: string; role: MemberRole }[];
  invites: { id: string; email: string; role: MemberRole; token: string; expiresAt: string }[];
}

const ROLES: MemberRole[] = ['owner', 'manager', 'kitchen'];

export function TeamManager({
  isOwner,
  currentUserId,
  inviteBase,
  members,
  invites,
}: TeamManagerProps) {
  const t = useTranslations('admin.team');
  const ta = useTranslations('admin');
  const locale = useLocale();
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
      day: 'numeric',
      month: 'long',
      timeZone: 'Europe/Paris',
    }).format(new Date(iso));
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'manager' | 'kitchen'>('manager');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; url: string } | null>(null);

  const errorText = (code: string) =>
    t.has(`errors.${code}`)
      ? t(`errors.${code}`)
      : code === 'forbidden'
        ? ta('forbidden')
        : ta('saveError');

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const result = await fn();
      if (result.ok) {
        toast(ta('saved'));
        router.refresh();
      } else toast(errorText(result.error ?? 'server_error'), 'error');
    });

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast(t('copied'));
    } catch {
      // Presse-papiers indisponible : le lien reste sélectionnable.
    }
  };

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    start(async () => {
      const result = await inviteMember({ email, role });
      if (!result.ok) {
        setInviteError(errorText(result.error));
        return;
      }
      setCreated({ email, url: `${inviteBase}${result.token}` });
      setEmail('');
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <Card className="p-2 sm:p-3">
        <h2 className="px-3 pb-1 pt-3 text-[20px] font-bold tracking-display">{t('members')}</h2>
        <ul className="divide-y divide-line/[0.06]">
          {members.map((m) => {
            const isMe = m.userId === currentUserId;
            return (
              <li key={m.userId} className="flex flex-wrap items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {m.email}
                    {isMe ? <span className="font-normal text-fg-muted"> ({t('you')})</span> : null}
                  </p>
                  <p className="text-[14px] text-fg-muted">{t(`roleHints.${m.role}`)}</p>
                </div>
                {isOwner ? (
                  <>
                    <select
                      aria-label={t('role', { email: m.email })}
                      value={m.role}
                      disabled={pending}
                      onChange={(e) =>
                        run(() =>
                          changeRole({ userId: m.userId, role: e.target.value as MemberRole }),
                        )
                      }
                      className="h-11 rounded-full bg-fg/[0.06] px-4 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue/50"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(`roles.${r}`)}
                        </option>
                      ))}
                    </select>
                    {isMe ? null : confirming === m.userId ? (
                      <span className="flex items-center gap-1">
                        <Button
                          variant="destructive"
                          size="sm"
                          loading={pending}
                          aria-label={t('confirmRemove', { email: m.email })}
                          onClick={() => {
                            setConfirming(null);
                            run(() => removeMember(m.userId));
                          }}
                        >
                          {t('confirm')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={ta('cancel')}
                          onClick={() => setConfirming(null)}
                        >
                          <X className="size-5" aria-hidden />
                        </Button>
                      </span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('remove', { email: m.email })}
                        onClick={() => setConfirming(m.userId)}
                      >
                        <Trash2 className="size-5" aria-hidden />
                      </Button>
                    )}
                  </>
                ) : (
                  <span className="rounded-full bg-fg/[0.06] px-3 py-1 text-[14px] font-semibold">
                    {t(`roles.${m.role}`)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {isOwner ? (
        <>
          <Card className="p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-[20px] font-bold tracking-display">
              <UserPlus className="size-5 text-blue" aria-hidden />
              {t('invite')}
            </h2>
            <p className="mt-1 text-fg-muted">{t('inviteHint')}</p>
            <form onSubmit={invite} noValidate className="mt-5 space-y-4">
              <Field id="invite-email" label={t('email')} error={inviteError}>
                <input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  maxLength={254}
                  required
                  className={inputClass}
                />
              </Field>
              <div className="space-y-1.5">
                <p className="font-semibold" aria-hidden>
                  {t('inviteRole')}
                </p>
                <Segmented
                  label={t('inviteRole')}
                  value={role}
                  onChange={setRole}
                  options={[
                    { value: 'manager', label: t('roles.manager') },
                    { value: 'kitchen', label: t('roles.kitchen') },
                  ]}
                  className="max-w-sm"
                />
                <p className="text-[14px] text-fg-muted">{t(`roleHints.${role}`)}</p>
              </div>
              <Button type="submit" loading={pending} disabled={!email.trim()}>
                {t('send')}
              </Button>
            </form>
            {created ? (
              <div role="status" className="mt-5 rounded-2xl bg-green/10 p-4">
                <p className="font-medium">{t('linkReady', { email: created.email })}</p>
                <div className="mt-2 flex items-center gap-2 rounded-2xl bg-surface py-1 pl-4 pr-1">
                  <span className="min-w-0 flex-1 select-all truncate text-[15px]">
                    {created.url}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('copy')}
                    onClick={() => copy(created.url)}
                  >
                    <Copy className="size-5" aria-hidden />
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>

          {invites.length > 0 ? (
            <Card className="p-2 sm:p-3">
              <h2 className="px-3 pb-1 pt-3 text-[20px] font-bold tracking-display">
                {t('pending')}
              </h2>
              <ul className="divide-y divide-line/[0.06]">
                {invites.map((i) => {
                  const expired = new Date(i.expiresAt) < new Date();
                  return (
                    <li key={i.id} className="flex items-center gap-2 px-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{i.email}</p>
                        <p className="text-[14px] text-fg-muted">
                          {t(`roles.${i.role}`)} ·{' '}
                          {expired ? t('expired') : t('expires', { date: formatDate(i.expiresAt) })}
                        </p>
                      </div>
                      {expired ? null : (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${t('copy')} · ${i.email}`}
                          onClick={() => copy(`${inviteBase}${i.token}`)}
                        >
                          <Copy className="size-5" aria-hidden />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('revoke', { email: i.email })}
                        onClick={() => run(() => revokeInvite(i.id))}
                      >
                        <X className="size-5" aria-hidden />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}
        </>
      ) : (
        <p className="text-fg-muted">{t('readOnly')}</p>
      )}
    </div>
  );
}
