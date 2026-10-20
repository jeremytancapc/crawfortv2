"use client";

import { useLocale } from "@/app/i18n/locale-provider";

export function LocaleText({ text }: { text: string }) {
  const { t } = useLocale();
  return t(text);
}
