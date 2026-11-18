'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, inputClass } from '@/components/ui/input';
import { PageHeader } from '@/components/page-header';
import { ResumeDropzone } from '@/components/resume-dropzone';
import { AnalysisProgress } from '@/components/analysis-progress';
import { api } from '@/lib/api';
import type { RoleTemplate } from '@/lib/types';

const MAX_BYTES = 5 * 1024 * 1024;

export default function NewAnalysisPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [roleTitle, setRoleTitle] = useState('');
  const [company, setCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getRoleTemplates().then(setTemplates).catch(() => undefined);
  }, []);

  function applyTemplate(id: string) {
    setTemplateId(id);
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setRoleTitle(template.title);
    setJobDescription(
      [
        `${template.title} — ${template.description}`,
        `Required skills: ${template.requiredSkills.join(', ')}.`,
        `Nice to have: ${template.niceToHave.join(', ')}.`,
      ].join('\n\n'),
    );
  }

  function selectFile(selected: File) {
    if (!/\.(pdf|docx)$/i.test(selected.name)) return setFileError('Please upload a PDF or DOCX file.');
    if (selected.size > MAX_BYTES) return setFileError('That file is over 5 MB.');
    setFileError(null);
    setFile(selected);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return setFileError('Upload your resume to continue.');
    setError(null);
    setBusy(true);
    try {
      const result = await api.createAnalysis({ resume: file, jobDescription, roleTitle, company });
      router.push(`/analysis/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.');
      setBusy(false);
    }
  }

  if (busy) return <AnalysisProgress />;

  return (
    <>
      <PageHeader eyebrow="New analysis" title="Match your resume to a role" description="Upload your resume and paste the job description." />
      <form onSubmit={submit} className="grid gap-8 lg:grid-cols-2">
        <ResumeDropzone file={file} error={fileError} onFileSelect={selectFile} onRemove={() => setFile(null)} />
        <div className="flex flex-col gap-4">
          <Field label="Start from a role template (optional)">
            <select value={templateId} onChange={(e) => applyTemplate(e.target.value)} className={inputClass}>
              <option value="">Paste my own job description</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </Field>
          <Field label="Role title">
            <Input required maxLength={160} value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="Backend Engineer" />
          </Field>
          <Field label="Company (optional)">
            <Input maxLength={160} value={company} onChange={(e) => setCompany(e.target.value)} />
          </Field>
          <Field label="Job description">
            <Textarea required minLength={50} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste the full job description" className="min-h-[220px]" />
          </Field>
          {error ? <p role="alert" className="text-sm font-medium text-rose-600">{error}</p> : null}
          <Button type="submit" className="rounded-xl">
            Analyze resume
          </Button>
        </div>
      </form>
    </>
  );
}
