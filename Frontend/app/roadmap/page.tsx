'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookOpen, Check, Code2, ExternalLink, ListVideo, Loader2, Play, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, inputClass } from '@/components/ui/input';
import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import { MaterialDialog, videoId, type Material } from '@/components/material-dialog';
import type { AnalysisResult, ResourceLink, Roadmap, RoadmapDay } from '@/lib/types';

// Ticked tasks are stored on the server so progress follows the account.
function useProgress(roadmap: Roadmap | null) {
  const [done, setDone] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDone(roadmap?.progress?.done ?? []);
  }, [roadmap]);

  async function toggle(id: string) {
    if (!roadmap) return;
    const previous = done;
    const next = done.includes(id) ? done.filter((x) => x !== id) : [...done, id];
    setDone(next);
    setSaving(true);
    try {
      await api.updateRoadmapProgress(roadmap.id, next);
    } catch {
      setDone(previous); // keep the UI honest when the save fails
    } finally {
      setSaving(false);
    }
  }

  return { done, toggle, saving };
}

function VideoCard({ link, onOpen }: { link: ResourceLink; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="group flex flex-col gap-2 text-left">
      <span className="relative block aspect-video overflow-hidden rounded-xl bg-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://i.ytimg.com/vi/${videoId(link.url)}/mqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover:bg-black/40">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg"><Play className="h-5 w-5 fill-current" /></span>
        </span>
      </span>
      <span className="line-clamp-2 text-sm font-medium leading-snug">{link.title}</span>
      <span className="-mt-1 truncate text-xs text-muted-foreground">{link.channel}</span>
    </button>
  );
}

function RowLink({ icon: Icon, label, link, tone, onOpen }: { icon: typeof Play; label: string; link: ResourceLink; tone: string; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
      <span className="min-w-0">
        <span className="line-clamp-2 font-medium">{label}{link.title}</span>
        {link.channel ? <span className="block text-xs text-muted-foreground">{link.channel}</span> : null}
      </span>
    </button>
  );
}

const DIFFICULTY_STYLE: Record<string, string> = {
  Easy: 'bg-emerald-100 text-emerald-800',
  Medium: 'bg-amber-100 text-amber-800',
  Hard: 'bg-rose-100 text-rose-800',
};

function PracticeList({ problems }: { problems: RoadmapDay['practice'] }) {
  return (
    <div className="space-y-1 border-t pt-4">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Code2 className="h-3.5 w-3.5" />Practice on LeetCode
      </p>
      {problems.map((p) => (
        <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-slate-100">
          <span className="min-w-0">
            <span className="block truncate font-medium">{p.title}</span>
            <span className="text-xs text-muted-foreground">{p.topic.replace(/-/g, ' ')}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${DIFFICULTY_STYLE[p.difficulty] ?? 'bg-slate-100 text-slate-700'}`}>{p.difficulty}</span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
          </span>
        </a>
      ))}
    </div>
  );
}

function DayCard({ d, done, toggle, open }: { d: RoadmapDay; done: string[]; toggle: (id: string) => void; open: (m: Material) => void }) {
  const ids = d.tasks.map((_, i) => `${d.day}-${i}`);
  const complete = ids.every((id) => done.includes(id));
  return (
    <Card className={`rounded-2xl ${complete ? 'border-emerald-300 bg-emerald-50/40' : ''}`}>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">Day {d.day}</span>
          <span className="text-xs text-muted-foreground">{d.hours} h</span>
        </div>
        <div>
          <p className="font-display text-xl">{d.title}</p>
          <p className="mt-1 text-muted-foreground">{d.focus}</p>
        </div>
        {d.closes ? (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            <Target className="mt-0.5 h-4 w-4 shrink-0" />Fixes: {d.closes}
          </p>
        ) : null}
        <ul className="space-y-2">
          {d.tasks.map((t, i) => {
            const checked = done.includes(ids[i]);
            return (
              <li key={ids[i]}>
                <button type="button" onClick={() => toggle(ids[i])} className="flex w-full items-start gap-3 text-left" aria-pressed={checked}>
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white'}`}>
                    {checked ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                  <span className={checked ? 'text-muted-foreground line-through' : ''}>{t}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {d.practice?.length ? <PracticeList problems={d.practice} /> : null}
        {d.resources.length > 0 ? (
          <div className="space-y-3 border-t pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Learn this</p>
            {d.resources.map((r) => (
              <div key={r.query} className="space-y-1.5">
                <p className="text-sm font-semibold">{r.topic}</p>
                {r.videos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {r.videos.map((v) => <VideoCard key={v.url} link={v} onOpen={() => open({ kind: 'video', link: v })} />)}
                  </div>
                ) : null}
                {r.playlist ? <RowLink icon={ListVideo} label="Playlist: " link={r.playlist} tone="text-brand-600" onOpen={() => open({ kind: 'playlist', link: r.playlist! })} /> : null}
                {r.articles.map((a) => <RowLink key={a.url} icon={BookOpen} label="GFG: " link={a} tone="text-emerald-600" onOpen={() => open({ kind: 'article', link: a })} />)}
                {!r.playlist && r.videos.length === 0 && r.articles.length === 0 ? (
                  <span className="flex gap-2">
                    <a href={r.videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100">
                      <Play className="h-3.5 w-3.5" />Search videos
                    </a>
                    <a href={r.playlistUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                      <ListVideo className="h-3.5 w-3.5" />Search playlists
                    </a>
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Progress({ done, roadmap }: { done: string[]; roadmap: Roadmap }) {
  const total = roadmap.days.reduce((n, d) => n + d.tasks.length, 0);
  const count = roadmap.days.reduce((n, d) => n + d.tasks.filter((_, i) => done.includes(`${d.day}-${i}`)).length, 0);
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm font-medium"><span>Your progress</span><span>{count} / {total} tasks</span></div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

function RoadmapView() {
  const preselected = useSearchParams().get('analysis') ?? '';
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [analysisId, setAnalysisId] = useState(preselected);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { done, toggle, saving } = useProgress(roadmap);
  const [material, setMaterial] = useState<Material | null>(null);

  useEffect(() => {
    api.listAnalyses().then((list) => {
      setAnalyses(list);
      if (!preselected && list[0]) setAnalysisId(String(list[0].id));
    }).catch((err) => setError(err.message));
  }, [preselected]);

  useEffect(() => {
    setRoadmap(null);
    if (!analysisId) return;
    api.listRoadmaps(Number(analysisId)).then((list) => setRoadmap(list[0] ?? null)).catch(() => undefined);
  }, [analysisId]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      setRoadmap(await api.createRoadmap(Number(analysisId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the roadmap.');
    }
    setBusy(false);
  }

  if (analyses.length === 0 && !error) {
    return <p className="text-muted-foreground">Run a resume analysis first, then come back to build your roadmap.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:max-w-xl sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field label="Analysis">
            <select className={inputClass} value={analysisId} onChange={(e) => setAnalysisId(e.target.value)}>
              {analyses.map((a) => <option key={a.id} value={a.id}>{a.roleTitle}{a.company ? ` · ${a.company}` : ''}</option>)}
            </select>
          </Field>
        </div>
        <Button onClick={generate} disabled={busy || !analysisId} className="rounded-xl">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Building</> : roadmap ? 'Regenerate' : 'Generate roadmap'}
        </Button>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-rose-600">{error}</p> : null}

      {roadmap ? (
        <>
          <div className="max-w-3xl space-y-3">
            <p className="text-lg">{roadmap.summary}</p>
            <Progress done={done} roadmap={roadmap} />
            {saving ? <p className="text-xs text-muted-foreground">Saving progress…</p> : null}
            <p className="text-sm text-muted-foreground">
              Tap a video, playlist or article to open it in a pop-up. Links are real YouTube and GeeksforGeeks results.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {roadmap.days.map((d) => <DayCard key={d.day} d={d} done={done} toggle={toggle} open={setMaterial} />)}
          </div>
        </>
      ) : null}
      <MaterialDialog material={material} onClose={() => setMaterial(null)} />
    </div>
  );
}

export default function RoadmapPage() {
  return (
    <>
      <PageHeader eyebrow="Roadmap" title="Your 7-day plan" description="Built from your skill gaps and your latest mock interview." />
      <Suspense><RoadmapView /></Suspense>
    </>
  );
}
