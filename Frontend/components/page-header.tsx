import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  backHref,
  backLabel,
}: PageHeaderProps) {
  return (
    <header className="animate-fade-up mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-3">
        {backHref && backLabel ? (
          <Link
            href={backHref}
            className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-brand-600"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        ) : null}
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">{eyebrow}</p>
        ) : null}
        <h1 className="font-display text-3xl leading-[1.2] tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-3">{actions}</div> : null}
    </header>
  );
}
