export type RequirementStatus = 'strong' | 'partial' | 'missing';
export type SuggestionPriority = 'critical' | 'recommended' | 'optional';

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface ScoreBreakdown {
  technicalSkills: number;
  experienceRelevance: number;
  keywordCoverage: number;
  projectRelevance: number;
  readability: number;
}

export interface Requirement {
  id: string;
  requirement: string;
  evidence: string | null;
  status: RequirementStatus;
}

export interface Suggestion {
  id: string;
  priority: SuggestionPriority;
  title: string;
  gap: string;
  why: string;
  howToImprove: string;
}

export interface AnalysisResult {
  id: number;
  roleTitle: string;
  company: string | null;
  jobDescription: string;
  resumeFileName: string;
  overallScore: number;
  matchPercent: number;
  breakdown: ScoreBreakdown;
  requirements: Requirement[];
  suggestions: Suggestion[];
  takeaways: string[];
  matchedSkills: string[];
  missingSkills: string[];
  createdAt: string;
}

export interface Question {
  question: string;
  category: 'technical' | 'behavioral' | 'situational';
  focus: string;
}

export interface DimensionScores {
  communication: number;
  technicalDepth: number;
  problemSolving: number;
  confidence: number;
}

export interface AnswerEvaluation {
  score: number;
  dimensions?: DimensionScores;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export interface FollowUpQuestion {
  question: string;
  focus: string;
}

export interface Answer {
  questionIndex: number;
  transcript: string;
  evaluation: AnswerEvaluation;
}

export interface Interview {
  id: number;
  analysisId: number | null;
  roleTitle: string;
  questions: Question[];
  answers: Answer[];
  averageScore: number | null;
  createdAt: string;
}

export interface ResourceLink {
  title: string;
  url: string;
  channel: string;
  description: string;
}

export interface RoadmapResource {
  topic: string;
  query: string;
  videoUrl: string;
  playlistUrl: string;
  videos: ResourceLink[];
  playlist: ResourceLink | null;
  articles: ResourceLink[];
}

export interface PracticeProblem {
  title: string;
  url: string;
  difficulty: string;
  topic: string;
}

export interface RoadmapDay {
  day: number;
  title: string;
  focus: string;
  hours: number;
  tasks: string[];
  closes: string;
  resources: RoadmapResource[];
  practice: PracticeProblem[];
}

export interface Roadmap {
  id: number;
  analysisId: number;
  interviewId: number | null;
  summary: string;
  days: RoadmapDay[];
  progress?: { done?: string[] };
  createdAt: string;
}

export interface HighlightRect {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ResumeHighlight {
  id: string;
  kind: 'strength' | 'weakness';
  quote: string;
  comment: string;
  suggestion: string | null;
  start: number;
  end: number;
  rects: HighlightRect[];
}

export interface ResumeReview {
  analysisId: number;
  mode: 'pdf' | 'text';
  pageCount: number;
  resumeText: string | null;
  highlights: ResumeHighlight[];
}

// --- Role templates ---
export interface RoleTemplate {
  id: string;
  title: string;
  description: string;
  requiredSkills: string[];
  niceToHave: string[];
}

// --- Mock tests ---
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface MCQOption {
  text: string;
}

export interface MCQuestion {
  question: string;
  options: MCQOption[];
  correctIndex: number;
  topic: string;
  difficulty: Difficulty;
  explanation: string;
}

export interface QuestionResult {
  questionIndex: number;
  selected: number;
  correct: number;
  isCorrect: boolean;
  topic: string;
}

export interface WeakTopic {
  topic: string;
  correct: number;
  total: number;
}

export interface MockTestResult {
  score: number;
  total: number;
  percentage: number;
  results: QuestionResult[];
  weakTopics: WeakTopic[];
}

export interface MockTest {
  id: number;
  analysisId: number;
  roleTitle: string;
  questions: MCQuestion[];
  result: MockTestResult | null;
  createdAt: string;
}

// --- Resume builder ---
export interface PersonalInfo {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  portfolio: string;
}

export interface ExperienceEntry {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
}

export interface ProjectEntry {
  name: string;
  description: string;
  technologies: string[];
  link: string;
}

export interface EducationEntry {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  gpa: string;
}

export interface CertificationEntry {
  name: string;
  issuer: string;
  date: string;
}

export interface ResumeData {
  personal: PersonalInfo;
  summary: string;
  skills: string[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  certifications: CertificationEntry[];
}

export interface SavedResume {
  id: number;
  data: ResumeData;
  createdAt: string;
  updatedAt: string;
}
