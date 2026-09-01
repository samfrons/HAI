'use client';

import { useLocale } from '@/lib/i18n/context';
import { IconDocument, IconSearch, IconShield, IconWarning } from './icons';

const SECTION_ICONS = [IconSearch, IconShield, IconDocument, IconWarning];

export function AboutContent() {
  const { t } = useLocale();
  const sections = [t.about.grounded, t.about.safety, t.about.evals, t.about.limits];

  return (
    <div>
      <h1 className="hai-heading text-2xl text-foreground sm:text-3xl">{t.about.title}</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{t.about.intro}</p>

      {/* The one genuinely sequential thing on this page — worth showing as a
          pipeline rather than folding it into prose. */}
      <div className="hai-data mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-border-subtle py-3 text-xs text-foreground">
        <span>search</span>
        <span className="text-accent">→</span>
        <span>cite</span>
        <span className="text-accent">→</span>
        <span>verify</span>
      </div>

      <div className="mt-2 divide-y divide-border-subtle">
        {sections.map((section, index) => {
          const Icon = SECTION_ICONS[index];
          return (
            <section key={section.heading} className="flex gap-4 py-6">
              <Icon size={22} className="mt-0.5 shrink-0 text-accent" />
              <div>
                <h2 className="hai-heading text-base text-foreground">{section.heading}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{section.body}</p>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
