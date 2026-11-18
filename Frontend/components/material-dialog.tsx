'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { BookOpen, ExternalLink, X } from 'lucide-react';
import type { ResourceLink } from '@/lib/types';

export type Material = { kind: 'video' | 'playlist' | 'article'; link: ResourceLink };

function param(url: string, key: string): string {
  try {
    return new URL(url).searchParams.get(key) ?? '';
  } catch {
    return '';
  }
}

export const videoId = (url: string) => param(url, 'v');

function embedSrc(m: Material): string {
  const base = 'https://www.youtube-nocookie.com/embed/';
  return m.kind === 'playlist'
    ? `${base}videoseries?list=${encodeURIComponent(param(m.link.url, 'list'))}&autoplay=1&rel=0`
    : `${base}${encodeURIComponent(videoId(m.link.url))}?autoplay=1&rel=0`;
}

// Opens YouTube material in an embedded player. GeeksforGeeks blocks embedding, so articles get a preview card.
export function MaterialDialog({ material, onClose }: { material: Material | null; onClose: () => void }) {
  const isArticle = material?.kind === 'article';
  return (
    <Dialog.Root open={material !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl focus:outline-none"
        >
          {material ? (
            <>
              {isArticle ? (
                <div className="flex flex-col gap-4 bg-gradient-to-br from-emerald-50 to-white p-8 sm:p-10">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                    <BookOpen className="h-3.5 w-3.5" />GeeksforGeeks article
                  </span>
                  {material.link.description ? <p className="text-lg leading-relaxed text-slate-700">{material.link.description}</p> : null}
                  <p className="text-sm text-muted-foreground">GeeksforGeeks does not allow its pages to be shown inside other sites, so the full article opens in a new tab.</p>
                </div>
              ) : (
                <div className="aspect-video w-full bg-black">
                  <iframe
                    key={material.link.url}
                    src={embedSrc(material)}
                    title={material.link.title}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                  />
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div className="min-w-0">
                  <Dialog.Title className="font-display text-xl leading-snug">{material.link.title}</Dialog.Title>
                  {material.link.channel ? <p className="text-sm text-muted-foreground">{material.link.channel}</p> : null}
                </div>
                <a
                  href={material.link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  <ExternalLink className="h-4 w-4" />{isArticle ? 'Read full article' : 'Open on YouTube'}
                </a>
              </div>
            </>
          ) : null}
          <Dialog.Close aria-label="Close" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
            <X className="h-5 w-5" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
