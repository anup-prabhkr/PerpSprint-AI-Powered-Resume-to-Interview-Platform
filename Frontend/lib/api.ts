import type {
  Answer,
  AnalysisResult,
  FollowUpQuestion,
  Interview,
  MockTest,
  ResumeData,
  ResumeReview,
  Roadmap,
  RoleTemplate,
  SavedResume,
  User,
} from './types';

// Tolerate a base URL pasted with a trailing slash or a trailing "/api":
// both otherwise produce "//api/..." or "/api/api/...", which the API answers
// with a 404 "Not Found".
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');
const BASE = `${API_ORIGIN}/api`;
const TOKEN_KEY = 'prepsprint_token';

// Full-page navigation, not fetch: the backend sets the OAuth state cookie on this
// response, so the request has to be first-party.
export const googleSignInUrl = (next = '/') =>
  `${BASE}/auth/google/start?next=${encodeURIComponent(next)}`;

export const tokenStore = {
  get: () => (typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY)),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (typeof init.body === 'string') headers.set('Content-Type', 'application/json');

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0);
  }
  if (!res.ok) {
    if (res.status === 401 && token) {
      tokenStore.clear();
      window.dispatchEvent(new Event('auth:expired'));
    }
    const body = await res.json().catch(() => null);
    throw new ApiError(typeof body?.detail === 'string' ? body.detail : 'Something went wrong.', res.status);
  }
  return res;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await send(path, init);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const json = (data: unknown) => JSON.stringify(data);

export const api = {
  register: (name: string, email: string, password: string) =>
    request<{ accessToken: string; user: User }>('/auth/register', { method: 'POST', body: json({ name, email, password }) }),
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: User }>('/auth/login', { method: 'POST', body: json({ email, password }) }),
  me: () => request<User>('/auth/me'),
  googleStatus: () => request<{ enabled: boolean }>('/auth/google/status'),

  listAnalyses: () => request<AnalysisResult[]>('/analyses'),
  getAnalysis: (id: number) => request<AnalysisResult>(`/analyses/${id}`),
  deleteAnalysis: (id: number) => request<void>(`/analyses/${id}`, { method: 'DELETE' }),
  createAnalysis: (input: { resume: File; jobDescription: string; roleTitle: string; company: string }) => {
    const form = new FormData();
    form.append('resume', input.resume);
    form.append('job_description', input.jobDescription);
    form.append('role_title', input.roleTitle);
    form.append('company', input.company);
    return request<AnalysisResult>('/analyses', { method: 'POST', body: form });
  },

  reviewResume: (id: number, regenerate = false) =>
    request<ResumeReview>(`/analyses/${id}/review${regenerate ? '?regenerate=true' : ''}`, { method: 'POST' }),
  getResumePage: async (id: number, page: number) =>
    URL.createObjectURL(await (await send(`/analyses/${id}/resume/pages/${page}`)).blob()),

  createInterview: (input: { analysisId?: number; roleTitle?: string; questionCount?: number }) =>
    request<Interview>('/interviews', { method: 'POST', body: json(input) }),
  submitAnswer: (interviewId: number, questionIndex: number, audio: Blob) => {
    const form = new FormData();
    form.append('question_index', String(questionIndex));
    form.append('audio', audio, 'answer.webm');
    return request<Answer>(`/interviews/${interviewId}/answers`, { method: 'POST', body: form });
  },
  submitTypedAnswer: (interviewId: number, questionIndex: number, text: string) => {
    const form = new FormData();
    form.append('question_index', String(questionIndex));
    form.append('transcript', text);
    return request<Answer>(`/interviews/${interviewId}/answers`, { method: 'POST', body: form });
  },
  getFollowUp: (interviewId: number, questionIndex: number) => {
    const form = new FormData();
    form.append('question_index', String(questionIndex));
    return request<{ followUp: FollowUpQuestion }>(`/interviews/${interviewId}/follow-up`, {
      method: 'POST',
      body: form,
    });
  },

  listRoadmaps: (analysisId: number) => request<Roadmap[]>(`/roadmaps?analysisId=${analysisId}`),
  createRoadmap: (analysisId: number) =>
    request<Roadmap>('/roadmaps', { method: 'POST', body: json({ analysisId }) }),
  updateRoadmapProgress: (roadmapId: number, done: string[]) =>
    request<Roadmap>(`/roadmaps/${roadmapId}/progress`, { method: 'PATCH', body: json({ done }) }),

  getRoleTemplates: () => request<RoleTemplate[]>('/role-templates'),

  createMockTest: (analysisId: number) =>
    request<MockTest>('/mock-tests', { method: 'POST', body: json({ analysisId }) }),
  getMockTest: (id: number) => request<MockTest>(`/mock-tests/${id}`),
  listMockTests: () => request<MockTest[]>('/mock-tests'),
  submitMockTest: (id: number, answers: Record<string, number>) =>
    request<MockTest>(`/mock-tests/${id}/submit`, { method: 'POST', body: json({ answers }) }),

  parseResume: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<ResumeData>('/resumes/parse', { method: 'POST', body: form });
  },
  createResume: (data: ResumeData) =>
    request<SavedResume>('/resumes', { method: 'POST', body: json({ data }) }),
  getResume: (id: number) => request<SavedResume>(`/resumes/${id}`),
  listResumes: () => request<SavedResume[]>('/resumes'),
  updateResume: (id: number, data: ResumeData) =>
    request<SavedResume>(`/resumes/${id}`, { method: 'PUT', body: json({ data }) }),
  deleteResume: (id: number) => request<void>(`/resumes/${id}`, { method: 'DELETE' }),
  downloadResume: async (id: number, template: 'professional' | 'minimal' = 'professional') => {
    const res = await send(`/resumes/${id}/export?template=${template}`);
    return URL.createObjectURL(await res.blob());
  },
};
