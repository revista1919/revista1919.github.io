import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Matcher: Run only on paths that need i18n; skips API, static files, _next, etc.
  // This prevents loops on internal Next.js paths
  matcher: '/((?!api|_next|.*\\..*).*)',
};