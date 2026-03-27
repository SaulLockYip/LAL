import type { Conversation, Message, ChatContext } from '../types/chat';

const API_BASE = '/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const data: ApiResponse<T> = await response.json();

  if (!data.success) {
    throw new Error(data.error?.message || 'An error occurred');
  }

  return data.data as T;
}

export async function getConversations(): Promise<Conversation[]> {
  return fetchApi<Conversation[]>('/chat');
}

export async function createConversation(title?: string, articleId?: string): Promise<Conversation> {
  return fetchApi<Conversation>('/chat', {
    method: 'POST',
    body: JSON.stringify({ title, articleId }),
  });
}

export async function getConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] }> {
  return fetchApi<{ conversation: Conversation; messages: Message[] }>(`/chat/${id}`);
}

export async function deleteConversation(id: string): Promise<void> {
  await fetchApi<void>(`/chat/${id}`, { method: 'DELETE' });
}

export async function addMessage(conversationId: string, content: string, role: 'user' | 'assistant' = 'user'): Promise<Message> {
  return fetchApi<Message>(`/chat/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, role }),
  });
}

export interface StreamingOptions {
  conversationId?: string;
  message: string;
  context?: ChatContext;
  onChunk?: (chunk: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

export async function streamChat(options: StreamingOptions): Promise<string> {
  const { conversationId, message, context, onChunk, onComplete, onError } = options;

  const controller = new AbortController();

  try {
    const response = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId,
        message,
        context,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error?.message || 'Failed to stream chat');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        // Strip "data: " prefix for SSE format
        let dataLine = line;
        if (dataLine.startsWith('data: ')) {
          dataLine = dataLine.slice(6);
        } else if (dataLine.startsWith('data:')) {
          // Handle case where there's no space after data:
          dataLine = dataLine.slice(5).trimStart();
        }

        if (!dataLine.trim()) continue;

        try {
          const parsed = JSON.parse(dataLine);

          if (parsed.success === false && parsed.error) {
            throw new Error(parsed.error.message || 'Server error during streaming');
          }

          if (parsed.chunk) {
            fullResponse += parsed.chunk;
            onChunk?.(parsed.chunk);
          }

          if (parsed.done) {
            onComplete?.(fullResponse);
          }
        } catch (e) {
          if (e instanceof Error) {
            console.warn('NDJSON parse warning:', e.message);
          }
        }
      }
    }

    return fullResponse;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Stream was aborted');
    }
    if (error instanceof Error) {
      onError?.(error);
      throw error;
    }
    const err = new Error('Unknown error during streaming');
    onError?.(err);
    throw err;
  }
}
