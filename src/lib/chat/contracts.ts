export interface ChatConversationRecord {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatPersistedMessageRecord {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  context_chunks?: string[] | null;
}
