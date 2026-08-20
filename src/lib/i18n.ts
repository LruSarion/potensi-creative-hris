/**
 * Lightweight i18n scaffold. Default locale is Indonesian (platform is Indone-US).
 * Pattern: a typed dictionary + a `t()` helper. Swap the active locale/backing
 * store (e.g. next-intl) later without changing call sites.
 */

export type Locale = "id";

export const messages = {
  id: {
    "common.adminApp": "Admin App",
    "common.logout": "Keluar",
    "common.notifications": "Notifikasi",
    "common.noNotifications": "Tidak ada notifikasi.",
    "common.loadError": "Gagal memuat data.",
    "portal.potensiCreative": "Potensi Creative Platform",
    "auth.signin": "Masuk dengan Google",
    "auth.pin": "Masukkan PIN Internal",
    "auth.login": "Masuk ke Dashboard",
  },
} as const;

export type MessageKey = keyof (typeof messages)[typeof defaultLocale];

export const defaultLocale: Locale = "id";

/** Translate a key in the active locale (default: id). */
export function t(key: MessageKey, locale: Locale = defaultLocale): string {
  return messages[locale][key] ?? key;
}