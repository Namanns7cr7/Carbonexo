'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';

export interface EcoMindPageContext {
  route: string;
  pageTitle: string;
  activeFeature?: string;
  selectedEntityId?: string;
  visibleMetricIds?: string[];
  activeFilters?: Record<string, string>;
  scenarioId?: string;
  contextVersion: number;
  metadata?: Record<string, string | number | boolean | null>;
}

interface EcoMindContextValue {
  pageContext: EcoMindPageContext;
  setPageContext: (ctx: Partial<EcoMindPageContext>) => void;
  isGlobalChatOpen: boolean;
  setIsGlobalChatOpen: (open: boolean) => void;
  toggleGlobalChat: () => void;
  activeThreadId: string;
  setActiveThreadId: (id: string) => void;
  draftMessage: string;
  setDraftMessage: (draft: string) => void;
}

const DEFAULT_CONTEXT: EcoMindPageContext = {
  route: '/app',
  pageTitle: 'Dashboard',
  contextVersion: 1,
};

const DRAFT_STORAGE_KEY = 'carbonexo_ecomind_draft_msg';
const THREAD_STORAGE_KEY = 'carbonexo_ecomind_active_thread';

const EcoMindContext = createContext<EcoMindContextValue | null>(null);

export function EcoMindProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pageContext, setPageContextState] = useState<EcoMindPageContext>(() => ({
    ...DEFAULT_CONTEXT,
    route: pathname || '/app',
  }));

  const [isGlobalChatOpen, setIsGlobalChatOpen] = useState(false);
  const [activeThreadId, setActiveThreadIdState] = useState<string>('default-thread');
  const [draftMessage, setDraftMessageState] = useState<string>('');

  // Restore draft message and thread ID from session / localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (savedDraft) setDraftMessageState(savedDraft);

        const savedThread = localStorage.getItem(THREAD_STORAGE_KEY);
        if (savedThread) setActiveThreadIdState(savedThread);
      } catch (e) {
        console.warn('Failed to restore EcoMind state', e);
      }
    }
  }, []);

  // Sync draft message to localStorage
  const setDraftMessage = useCallback((draft: string) => {
    setDraftMessageState(draft);
    if (typeof window !== 'undefined') {
      try {
        if (draft) {
          localStorage.setItem(DRAFT_STORAGE_KEY, draft);
        } else {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        }
      } catch (e) {
        console.warn('Failed to persist draft message', e);
      }
    }
  }, []);

  // Sync active thread ID
  const setActiveThreadId = useCallback((threadId: string) => {
    setActiveThreadIdState(threadId);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(THREAD_STORAGE_KEY, threadId);
      } catch (e) {
        console.warn('Failed to persist active thread', e);
      }
    }
  }, []);

  // Update page context when pathname changes automatically
  useEffect(() => {
    if (pathname) {
      setPageContextState((prev) => ({
        ...prev,
        route: pathname,
        pageTitle: deriveTitleFromPath(pathname),
        contextVersion: prev.contextVersion + 1,
      }));
    }
  }, [pathname]);

  const setPageContext = useCallback((update: Partial<EcoMindPageContext>) => {
    setPageContextState((prev) => ({
      ...prev,
      ...update,
      contextVersion: prev.contextVersion + 1,
    }));
  }, []);

  const toggleGlobalChat = useCallback(() => {
    setIsGlobalChatOpen((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({
      pageContext,
      setPageContext,
      isGlobalChatOpen,
      setIsGlobalChatOpen,
      toggleGlobalChat,
      activeThreadId,
      setActiveThreadId,
      draftMessage,
      setDraftMessage,
    }),
    [
      pageContext,
      setPageContext,
      isGlobalChatOpen,
      toggleGlobalChat,
      activeThreadId,
      setActiveThreadId,
      draftMessage,
      setDraftMessage,
    ]
  );

  return <EcoMindContext.Provider value={value}>{children}</EcoMindContext.Provider>;
}

export function useEcoMindContext(): EcoMindContextValue {
  const ctx = useContext(EcoMindContext);
  if (!ctx) {
    throw new Error('useEcoMindContext must be used within an EcoMindProvider');
  }
  return ctx;
}

/**
 * Convenience hook for pages to register their specific context safely on mount/update.
 */
export function useRegisterPageContext(config: {
  pageTitle: string;
  activeFeature?: string;
  selectedEntityId?: string;
  visibleMetricIds?: string[];
  activeFilters?: Record<string, string>;
  scenarioId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  const { setPageContext } = useEcoMindContext();
  const pathname = usePathname();

  useEffect(() => {
    setPageContext({
      route: pathname,
      pageTitle: config.pageTitle,
      activeFeature: config.activeFeature,
      selectedEntityId: config.selectedEntityId,
      visibleMetricIds: config.visibleMetricIds,
      activeFilters: config.activeFilters,
      scenarioId: config.scenarioId,
      metadata: config.metadata,
    });
  }, [
    pathname,
    config.pageTitle,
    config.activeFeature,
    config.selectedEntityId,
    config.scenarioId,
    JSON.stringify(config.visibleMetricIds),
    JSON.stringify(config.activeFilters),
    JSON.stringify(config.metadata),
    setPageContext,
  ]);
}

function deriveTitleFromPath(path: string): string {
  if (path.includes('/coach')) return 'EcoMind Coach';
  if (path.includes('/track')) return 'Track Activity';
  if (path.includes('/credits')) return 'Green Credits';
  if (path.includes('/rewards')) return 'Eco Rewards';
  if (path.includes('/reports')) return 'Reports & Analytics';
  if (path.includes('/simulate')) return 'Carbon Twin Simulator';
  if (path.includes('/score')) return 'Climate Score';
  if (path.includes('/bills')) return 'Utility Bills';
  if (path.includes('/actions')) return 'Climate Actions';
  return 'Dashboard';
}
