export type UserRole = "member" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export type DocumentStatus = "processing" | "ready" | "failed";
export type DocumentFileType = "pdf" | "md" | "txt";

export interface DocumentItem {
  id: string;
  filename: string;
  file_type: DocumentFileType;
  status: DocumentStatus;
  page_count: number;
  chunk_count: number;
  tokens_used: number;
  error_message: string | null;
  created_at: string;
  owner_email?: string;
}

export interface Conversation {
  id: string;
  document_id: string;
  title: string;
  created_at: string;
  messages?: ChatMessage[];
}

export type MessageRole = "user" | "assistant";

export interface MessageSource {
  chunk_id: string;
  page_number: number | null;
  preview: string;
}

export interface ChatMessage {
  id?: string;
  role: MessageRole;
  content: string;
  sources: MessageSource[];
  prompt_tokens: number;
  completion_tokens: number;
  created_at?: string;
  pending?: boolean;
}

export interface AdminMetrics {
  documents: {
    total: number;
    ready: number;
    failed: number;
    processing: number;
  };
  users: number;
  conversations: number;
  messages: number;
  tokens: {
    embedding_tokens: number;
    chat_tokens: number;
    total: number;
  };
}

export interface ApiError {
  error: string;
}
