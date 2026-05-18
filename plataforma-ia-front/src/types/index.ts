export type FAQ = {
  id: string;
  question: string;
  answer: string;
}

export type ChatMessage = {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  files?: { name: string; size: number; url?: string; data?: string }[];
  characterCount?: number;
  responseTime?: number;
  isError?: boolean;
  errorType?: string;
  retryAfter?: number | null;
  isRetryable?: boolean;
  isStreaming?: boolean;
  thought?: string;
  steps?: {
    id: string;
    title: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    details?: string;
  }[];
  uiComponents?: UIComponentPayload[];
}

export type UIComponentKind = 'chart' | 'dashboard' | 'kpi' | 'infographic' | 'widget';

export type UIComponentPayload = {
  kind: UIComponentKind;
  spec: { id?: string; [key: string]: unknown };
}

