'use client';

import { useEffect, useState } from 'react';
import { Download, FilePlus2, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/input';
import { PageHeader } from '@/components/page-header';
import { ResumeDropzone } from '@/components/resume-dropzone';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type {
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
  PersonalInfo,
  ProjectEntry,
  ResumeData,
  SavedResume,
} from '@/lib/types';

const MAX_BYTES = 5 * 1024 * 1024;

const EMPTY: ResumeData = {
  personal: { name: '', email: '', phone: '', location: '', linkedin: '', portfolio: '' },
  summary: '',
  skills: [],
  experience: [],
  projects: [],
  education: [],
  certifications: [],
};

const EMPTY_EXPERIENCE: ExperienceEntry = {
  company: '',
  role: '',
  startDate: '',
  endDate: '',
  current: false,
  description: '',
};
const EMPTY_PROJECT: ProjectEntry = { name: '', description: '', technologies: [], link: '' };
const EMPTY_EDUCATION: EducationEntry = {
  institution: '',
  degree: '',
  field: '',
  startDate: '',
  endDate: '',
  gpa: '',
};
const EMPTY_CERTIFICATION: CertificationEntry = { name: '', issuer: '', date: '' };

type ListKey = 'experience' | 'projects' | 'education' | 'certifications';

function cleanResume(data: ResumeData): ResumeData {
  return {
    ...data,
    skills: data.skills.map((s) => s.trim()).filter(Boolean),
    projects: data.projects.map((p) => ({ ...p, technologies: p.technologies.filter(Boolean) })),
    experience: data.experience.filter((e) => e.company.trim() && e.role.trim()),
    education: data.education.filter((e) => e.institution.trim()),
    certifications: data.certifications.filter((c) => c.name.trim()),
  };
}

// Comma-separated text <-> string[] without losing the caret while typing.
function toList(value: string): string[] {
  return value.split(',').map((item) => item.replace(/^\s+/, ''));
}

function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl border-border/70">
      <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-xl">{title}</p>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function RowHeader({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label.toLowerCase()}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function ResumeBuilderPage() {
  const [data, setData] = useState<ResumeData>(EMPTY);
  const [resumeId, setResumeId] = useState<number | null>(null);
  const [saved, setSaved] = useState<SavedResume[]>([]);
  const [template, setTemplate] = useState<'professional' | 'minimal'>('professional');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refreshSaved() {
    try {
      setSaved(await api.listResumes());
    } catch {
      /* listing is best-effort */
    }
  }

  useEffect(() => {
    refreshSaved();
  }, []);

  function patchPersonal(patch: Partial<PersonalInfo>) {
    setData((prev) => ({ ...prev, personal: { ...prev.personal, ...patch } }));
  }

  function patchItem<K extends ListKey>(key: K, index: number, patch: Partial<ResumeData[K][number]>) {
    setData(
      (prev) =>
        ({
          ...prev,
          [key]: prev[key].map((item, i) => (i === index ? { ...item, ...patch } : item)),
        }) as ResumeData,
    );
  }

  function removeItem(key: ListKey, index: number) {
    setData((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }) as ResumeData);
  }

  function selectFile(selected: File) {
    if (!/\.(pdf|docx)$/i.test(selected.name)) return setFileError('Please upload a PDF or DOCX file.');
    if (selected.size > MAX_BYTES) return setFileError('That file is over 5 MB.');
    setFileError(null);
    setFile(selected);
  }

  async function importResume() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setData(await api.parseResume(file));
      setResumeId(null);
      setFile(null);
      setNotice('Resume imported. Review the fields, then save.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that resume.');
    }
    setBusy(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payload = cleanResume(data);
      const row = resumeId ? await api.updateResume(resumeId, payload) : await api.createResume(payload);
      setData(row.data);
      setResumeId(row.id);
      setNotice('Resume saved.');
      await refreshSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the resume.');
    }
    setBusy(false);
  }

  async function download() {
    if (!resumeId) {
      setError('Save the resume before downloading the PDF.');
      return;
    }
    setError(null);
    try {
      const url = await api.downloadResume(resumeId, template);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${data.personal.name.trim() || 'resume'}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export the PDF.');
    }
  }

  function load(row: SavedResume) {
    setData(row.data);
    setResumeId(row.id);
    setNotice(null);
    setError(null);
  }

  async function removeSaved(id: number) {
    setError(null);
    try {
      await api.deleteResume(id);
      if (resumeId === id) {
        setData(EMPTY);
        setResumeId(null);
      }
      await refreshSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete that resume.');
    }
  }

  function startBlank() {
    setData(EMPTY);
    setResumeId(null);
    setNotice(null);
    setError(null);
  }

  return (
    <>
      <PageHeader
        eyebrow="Resume builder"
        title="Build a clean, editable resume"
        description="Start from scratch or upload an existing resume to edit before saving and exporting."
        actions={
          <>
            <button
              type="button"
              onClick={startBlank}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
            >
              <FilePlus2 className="h-4 w-4" />
              New blank
            </button>
            <Button onClick={save} disabled={busy} className="rounded-xl">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {resumeId ? 'Save changes' : 'Save resume'}
            </Button>
          </>
        }
      />

      {error ? (
        <p role="alert" className="mb-4 text-sm font-medium text-rose-600">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mb-4 text-sm font-medium text-emerald-700">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-6">
          <SectionCard
            title="Upload an existing resume"
            description="PDF or DOCX up to 5 MB. We extract the fields so you can edit them before saving."
          >
            <ResumeDropzone file={file} error={fileError} onFileSelect={selectFile} onRemove={() => setFile(null)} />
            {file ? (
              <Button onClick={importResume} disabled={busy} className="w-fit rounded-xl">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Import and edit
              </Button>
            ) : null}
          </SectionCard>

          <SectionCard title="Personal information">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input maxLength={100} value={data.personal.name} onChange={(e) => patchPersonal({ name: e.target.value })} placeholder="Jane Doe" />
              </Field>
              <Field label="Email">
                <Input maxLength={200} value={data.personal.email} onChange={(e) => patchPersonal({ email: e.target.value })} placeholder="jane@example.com" />
              </Field>
              <Field label="Phone">
                <Input maxLength={30} value={data.personal.phone} onChange={(e) => patchPersonal({ phone: e.target.value })} placeholder="+1 555 0100" />
              </Field>
              <Field label="Location">
                <Input maxLength={100} value={data.personal.location} onChange={(e) => patchPersonal({ location: e.target.value })} placeholder="Bengaluru, India" />
              </Field>
              <Field label="LinkedIn">
                <Input maxLength={200} value={data.personal.linkedin} onChange={(e) => patchPersonal({ linkedin: e.target.value })} placeholder="linkedin.com/in/janedoe" />
              </Field>
              <Field label="Portfolio">
                <Input maxLength={200} value={data.personal.portfolio} onChange={(e) => patchPersonal({ portfolio: e.target.value })} placeholder="janedoe.dev" />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Professional summary">
            <Textarea
              maxLength={2000}
              value={data.summary}
              onChange={(e) => setData((prev) => ({ ...prev, summary: e.target.value }))}
              placeholder="Two or three sentences on what you do, your strongest stack and an outcome you are proud of."
              className="min-h-[120px]"
            />
          </SectionCard>

          <SectionCard title="Skills" description="Separate skills with commas.">
            <Input
              value={data.skills.join(', ')}
              onChange={(e) => setData((prev) => ({ ...prev, skills: toList(e.target.value) }))}
              placeholder="Python, FastAPI, PostgreSQL, Docker"
            />
          </SectionCard>

          <SectionCard
            title="Work experience"
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => setData((prev) => ({ ...prev, experience: [...prev.experience, { ...EMPTY_EXPERIENCE }] }))}
              >
                <Plus className="h-4 w-4" />Add
              </Button>
            }
          >
            {data.experience.length === 0 ? (
              <p className="text-sm text-muted-foreground">No experience added yet.</p>
            ) : (
              <div className="flex flex-col gap-5">
                {data.experience.map((exp, i) => (
                  <div key={i} className="flex flex-col gap-3 rounded-xl border border-border p-4">
                    <RowHeader label={`Position ${i + 1}`} onRemove={() => removeItem('experience', i)} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Company">
                        <Input maxLength={160} value={exp.company} onChange={(e) => patchItem('experience', i, { company: e.target.value })} />
                      </Field>
                      <Field label="Role">
                        <Input maxLength={160} value={exp.role} onChange={(e) => patchItem('experience', i, { role: e.target.value })} />
                      </Field>
                      <Field label="Start date">
                        <Input maxLength={20} value={exp.startDate} onChange={(e) => patchItem('experience', i, { startDate: e.target.value })} placeholder="Jan 2022" />
                      </Field>
                      <Field label="End date">
                        <Input
                          maxLength={20}
                          value={exp.current ? 'Present' : exp.endDate}
                          disabled={exp.current}
                          onChange={(e) => patchItem('experience', i, { endDate: e.target.value })}
                          placeholder="Mar 2024"
                        />
                      </Field>
                    </div>
                    <label className="flex w-fit items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        checked={exp.current}
                        onChange={(e) => patchItem('experience', i, { current: e.target.checked })}
                      />
                      I currently work here
                    </label>
                    <Field label="What you did">
                      <Textarea
                        maxLength={2000}
                        value={exp.description}
                        onChange={(e) => patchItem('experience', i, { description: e.target.value })}
                        placeholder={'One achievement per line\nCut API latency by 40% by adding Redis caching'}
                      />
                    </Field>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Projects"
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => setData((prev) => ({ ...prev, projects: [...prev.projects, { ...EMPTY_PROJECT }] }))}
              >
                <Plus className="h-4 w-4" />Add
              </Button>
            }
          >
            {data.projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects added yet.</p>
            ) : (
              <div className="flex flex-col gap-5">
                {data.projects.map((proj, i) => (
                  <div key={i} className="flex flex-col gap-3 rounded-xl border border-border p-4">
                    <RowHeader label={`Project ${i + 1}`} onRemove={() => removeItem('projects', i)} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Name">
                        <Input maxLength={160} value={proj.name} onChange={(e) => patchItem('projects', i, { name: e.target.value })} />
                      </Field>
                      <Field label="Link">
                        <Input maxLength={300} value={proj.link} onChange={(e) => patchItem('projects', i, { link: e.target.value })} placeholder="github.com/jane/project" />
                      </Field>
                    </div>
                    <Field label="Technologies" >
                      <Input
                        value={proj.technologies.join(', ')}
                        onChange={(e) => patchItem('projects', i, { technologies: toList(e.target.value) })}
                        placeholder="React, TypeScript, Node.js"
                      />
                    </Field>
                    <Field label="Description">
                      <Textarea
                        maxLength={1500}
                        value={proj.description}
                        onChange={(e) => patchItem('projects', i, { description: e.target.value })}
                      />
                    </Field>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Education"
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => setData((prev) => ({ ...prev, education: [...prev.education, { ...EMPTY_EDUCATION }] }))}
              >
                <Plus className="h-4 w-4" />Add
              </Button>
            }
          >
            {data.education.length === 0 ? (
              <p className="text-sm text-muted-foreground">No education added yet.</p>
            ) : (
              <div className="flex flex-col gap-5">
                {data.education.map((edu, i) => (
                  <div key={i} className="flex flex-col gap-3 rounded-xl border border-border p-4">
                    <RowHeader label={`Education ${i + 1}`} onRemove={() => removeItem('education', i)} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Institution">
                        <Input maxLength={200} value={edu.institution} onChange={(e) => patchItem('education', i, { institution: e.target.value })} />
                      </Field>
                      <Field label="Degree">
                        <Input maxLength={160} value={edu.degree} onChange={(e) => patchItem('education', i, { degree: e.target.value })} placeholder="B.Tech" />
                      </Field>
                      <Field label="Field of study">
                        <Input maxLength={160} value={edu.field} onChange={(e) => patchItem('education', i, { field: e.target.value })} placeholder="Computer Science" />
                      </Field>
                      <Field label="GPA">
                        <Input maxLength={10} value={edu.gpa} onChange={(e) => patchItem('education', i, { gpa: e.target.value })} placeholder="8.4" />
                      </Field>
                      <Field label="Start date">
                        <Input maxLength={20} value={edu.startDate} onChange={(e) => patchItem('education', i, { startDate: e.target.value })} placeholder="2020" />
                      </Field>
                      <Field label="End date">
                        <Input maxLength={20} value={edu.endDate} onChange={(e) => patchItem('education', i, { endDate: e.target.value })} placeholder="2024" />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Certifications"
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => setData((prev) => ({ ...prev, certifications: [...prev.certifications, { ...EMPTY_CERTIFICATION }] }))}
              >
                <Plus className="h-4 w-4" />Add
              </Button>
            }
          >
            {data.certifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No certifications added yet.</p>
            ) : (
              <div className="flex flex-col gap-5">
                {data.certifications.map((cert, i) => (
                  <div key={i} className="flex flex-col gap-3 rounded-xl border border-border p-4">
                    <RowHeader label={`Certification ${i + 1}`} onRemove={() => removeItem('certifications', i)} />
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="Name">
                        <Input maxLength={200} value={cert.name} onChange={(e) => patchItem('certifications', i, { name: e.target.value })} />
                      </Field>
                      <Field label="Issuer">
                        <Input maxLength={160} value={cert.issuer} onChange={(e) => patchItem('certifications', i, { issuer: e.target.value })} />
                      </Field>
                      <Field label="Date">
                        <Input maxLength={20} value={cert.date} onChange={(e) => patchItem('certifications', i, { date: e.target.value })} placeholder="2023" />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="rounded-2xl border-border/70">
            <CardContent className="flex flex-col gap-4 p-5">
              <p className="font-display text-lg">Export PDF</p>
              <Field label="Template">
                <select
                  className="w-full rounded-xl border border-input bg-white px-3.5 py-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value as 'professional' | 'minimal')}
                >
                  <option value="professional">Professional</option>
                  <option value="minimal">Minimal</option>
                </select>
              </Field>
              <Button onClick={download} variant="outline" className="rounded-xl">
                <Download className="h-4 w-4" />Download PDF
              </Button>
              {!resumeId ? <p className="text-xs text-muted-foreground">Save the resume first to enable export.</p> : null}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70">
            <CardContent className="flex flex-col gap-3 p-5">
              <p className="font-display text-lg">Saved resumes</p>
              {saved.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing saved yet.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {saved.map((row) => (
                    <li key={row.id} className="flex items-center gap-2 py-2.5">
                      {row.id === resumeId ? <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" /> : null}
                      <button type="button" onClick={() => load(row)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-medium">
                          {row.data.personal.name.trim() || 'Untitled resume'}
                        </span>
                        <span className="block text-xs text-muted-foreground">Updated {formatDate(row.updatedAt)}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSaved(row.id)}
                        aria-label="Delete resume"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
