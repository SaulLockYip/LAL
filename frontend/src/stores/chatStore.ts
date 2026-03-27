import { create } from 'zustand';
import type { Conversation, Message } from '../types/chat';
import * as chatApi from '../services/chatApi';

interface ChatState {
  isPanelOpen: boolean;
  currentConversationId: string | null;
  messages: Message[];
  conversations: Conversation[];
  isStreaming: boolean;
  streamingContent: string;

  // Actions
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setCurrentConversation: (id: string | null) => void;
  addMessage: (message: Message) => void;
  updateStreamingContent: (content: string) => void;
  appendStreamingContent: (chunk: string) => void;
  clearMessages: () => void;
  clearStreamingContent: () => void;
  loadConversations: () => Promise<void>;
  createConversation: (title?: string, articleId?: string) => Promise<string>;
  deleteConversation: (id: string) => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  isPanelOpen: false,
  currentConversationId: null,
  messages: [],
  conversations: [],
  isStreaming: false,
  streamingContent: '',

  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false }),
  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),

  setCurrentConversation: (id) => set({ currentConversationId: id }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),

  updateStreamingContent: (content) => set({ streamingContent: content }),

  appendStreamingContent: (chunk) => set((state) => ({
    streamingContent: state.streamingContent + chunk,
  })),

  clearMessages: () => set({ messages: [], streamingContent: '' }),

  clearStreamingContent: () => set({ streamingContent: '' }),

  loadConversations: async () => {
    try {
      const conversations = await chatApi.getConversations();
      set({ conversations });
    } catch (error) {
      console.error('Failed to load conversations:', error);
      throw error;
    }
  },

  createConversation: async (title?: string, articleId?: string) => {
    try {
      const conversation = await chatApi.createConversation(title, articleId);
      set((state) => ({
        conversations: [conversation, ...state.conversations],
        currentConversationId: conversation.id,
        messages: [],
      }));
      return conversation.id;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    }
  },

  deleteConversation: async (id: string) => {
    try {
      await chatApi.deleteConversation(id);
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        currentConversationId: state.currentConversationId === id ? null : state.currentConversationId,
        messages: state.currentConversationId === id ? [] : state.messages,
      }));
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      throw error;
    }
  },

  loadConversation: async (id: string) => {
    try {
      const { conversation, messages } = await chatApi.getConversation(id);
      set({
        currentConversationId: conversation.id,
        messages,
        isPanelOpen: true,
      });
    } catch (error) {
      console.error('Failed to load conversation:', error);
      throw error;
    }
  },

  sendMessage: async (content: string) => {
    const state = get();
    const conversationId = state.currentConversationId;

    // Create a new conversation if needed
    let finalConversationId = conversationId;
    if (!finalConversationId) {
      finalConversationId = await get().createConversation();
    }

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      conversationId: finalConversationId,
      role: 'user',
      content,
      tokens: null,
      model: null,
      createdAt: new Date().toISOString(),
    };

    get().addMessage(userMessage);
    get().clearStreamingContent();
    set({ isStreaming: true });

    try {
      await chatApi.streamChat({
        conversationId: finalConversationId,
        message: content,
        onChunk: (chunk) => {
          get().appendStreamingContent(chunk);
        },
        onComplete: (fullResponse) => {
          // Add assistant message when streaming completes
          const assistantMessage: Message = {
            id: crypto.randomUUID(),
            conversationId: finalConversationId,
            role: 'assistant',
            content: fullResponse,
            tokens: null,
            model: null,
            createdAt: new Date().toISOString(),
          };
          get().addMessage(assistantMessage);
          set({ isStreaming: false, streamingContent: '' });
        },
        onError: (error) => {
          console.error('Streaming error:', error);
          set({ isStreaming: false, streamingContent: '' });
          // Add error message
          const errorMessage: Message = {
            id: crypto.randomUUID(),
            conversationId: finalConversationId,
            role: 'assistant',
            content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
            tokens: null,
            model: null,
            createdAt: new Date().toISOString(),
          };
          get().addMessage(errorMessage);
        },
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      set({ isStreaming: false, streamingContent: '' });
      throw error;
    }
  },
}));

// Context helper hook for chat with article/word list context
export function useChatContext() {
  return useChatStore((state) => ({
    messages: state.messages,
    isStreaming: state.isStreaming,
    streamingContent: state.streamingContent,
    sendMessage: state.sendMessage,
  }));
}
