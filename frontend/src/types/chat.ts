export interface Conversation {
  id: string;
  title: string | null;
  articleId: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens: number | null;
  model: string | null;
  createdAt: string;
}

export interface ChatContext {
  type: 'article' | 'word_list' | 'exercises' | 'global';
  articleId?: string;
  articleTitle?: string;
  articleContent?: string;
  wordList?: string[];
  userInfo?: {
    targetLanguage: string;
    nativeLanguage: string;
    currentLevel: string;
  };
}
