import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, resolveLocale } from './config';

export default getRequestConfig(async () => {
  const locale = resolveLocale(
    cookies().get(LOCALE_COOKIE)?.value,
    headers().get('accept-language'),
  );
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: 'Europe/Paris',
  };
});
