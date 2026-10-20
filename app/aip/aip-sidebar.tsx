"use client";

import Image from "next/image";
import { useLocale } from "@/app/i18n/locale-provider";

interface AipSidebarProps {
  title: string;
  description: string;
  points?: string[];
}

export function AipSidebar({ title, description, points }: AipSidebarProps) {
  const { t } = useLocale();

  return (
    <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-blue p-12 xl:w-[38%] lg:flex lg:w-[42%] xl:p-16">
      <div className="relative z-10">
        <div className="mb-16">
          <Image
            src="/images/cf-money-white.png"
            alt="CF Money"
            width={160}
            height={48}
            className="h-6 w-auto"
            priority
          />
        </div>

        <h1 className="max-w-[420px] font-display text-4xl font-bold leading-[1.1] tracking-tight text-[var(--text-on-brand)] xl:text-5xl">
          {t(title)}
        </h1>
        <p className="mt-6 max-w-[380px] text-lg leading-relaxed text-[var(--text-on-brand)] opacity-75">
          {t(description)}
        </p>
      </div>

      {points?.length ? (
        <div className="relative z-10 mt-12">
          <div className="flex flex-col gap-3">
            {points.map((point) => (
              <div key={point} className="flex items-start gap-3">
                <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white opacity-60" />
                <p className="text-sm text-[var(--text-on-brand)] opacity-75">{t(point)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
