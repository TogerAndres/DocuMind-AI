import type {
  AdminMetrics,
  ApiError,
  ChatMessage,
  Conversation,
  DocumentItem,
  User,
} from "@/types/api";

const TOKEN_KEY = "documind_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

class ApiRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`/api${path}`, { ...options, headers });
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : null;

  if (!res.ok) {
    const message = (data as ApiError | null)?.error ?? `Error ${res.status}`;
    throw new ApiRequestError(message, res.status);
  }
  return data as T;
}

// --- Auth ---
export const authApi = {
  register: (email: string, name: string, password: string) =>
    request<{ user: User; access_token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, name, password }),
    }),
  login: (email: string, password: string) =>
    request<{ user: User; access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ user: User }>("/auth/me"),
};

// --- Documents ---
export const documentsApi = {
  list: () => request<{ documents: DocumentItem[] }>("/documents"),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ document: DocumentItem }>("/documents", {
      method: "POST",
      body: form,
    });
  },
  remove: (id: string) =>
    request<{ success: boolean }>(`/documents/${id}`, { method: "DELETE" }),
  reprocess: (id: string) =>
    request<{ document: DocumentItem }>(`/documents/${id}/reprocess`, {
      method: "POST",
    }),
};

// --- Chat ---
export const chatApi = {
  listConversations: (documentId: string) =>
    request<{ conversations: Conversation[] }>(
      `/documents/${documentId}/conversations`
    ),
  createConversation: (documentId: string) =>
    request<{ conversation: Conversation }>(
      `/documents/${documentId}/conversations`,
      { method: "POST" }
    ),
  getConversation: (conversationId: string) =>
    request<{ conversation: Conversation }>(`/conversations/${conversationId}`),
};

// --- Admin ---
export const adminApi = {
  metrics: () => request<AdminMetrics>("/admin/metrics"),
  allDocuments: () => request<{ documents: DocumentItem[] }>("/admin/documents"),
};

/**
 * Streams an assistant reply over Server-Sent Events.
 * Calls onSources once, onToken for every chunk, and onDone at the end.
 */
export async function streamMessage(
  conversationId: string,
  content: string,
  handlers: {
    onSources?: (sources: ChatMessage["sources"]) => void;
    onToken?: (piece: string) => void;
    onDone?: (usage: { prompt_tokens: number; completion_tokens: number }) => void;
    onError?: (message: string) => void;
  }
): Promise<void> {
  const token = getToken();
  const res = await fetch(`/api/conversations/${conversationId}/messages/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ content }),
  });

  if (!res.ok || !res.body) {
    handlers.onError?.(`Error ${res.status} al conectar con el servidor`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const rawEvent of events) {
      const eventMatch = rawEvent.match(/^event: (\w+)\ndata: (.*)$/s);
      if (!eventMatch) continue;
      const [, eventName, rawData] = eventMatch;
      try {
        const data = JSON.parse(rawData);
        if (eventName === "sources") handlers.onSources?.(data);
        else if (eventName === "token") handlers.onToken?.(data);
        else if (eventName === "done") handlers.onDone?.(data);
      } catch {
        // ignore malformed SSE frame
      }
    }
  }
}

export { ApiRequestError };
