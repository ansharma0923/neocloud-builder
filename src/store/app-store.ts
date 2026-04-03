import { create } from 'zustand';

type RightPanelTab = 'files' | 'assumptions' | 'artifacts' | 'plan';

interface AppState {
  currentChatId: string | null;
  rightPanelOpen: boolean;
  rightPanelTab: RightPanelTab;
  isStreaming: boolean;
  uploadQueue: File[];

  setCurrentChatId: (id: string | null) => void;
  setRightPanelOpen: (open: boolean) => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  setIsStreaming: (streaming: boolean) => void;
  addToUploadQueue: (file: File) => void;
  removeFromUploadQueue: (name: string) => void;
  clearUploadQueue: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentChatId: null,
  rightPanelOpen: false,
  rightPanelTab: 'plan',
  isStreaming: false,
  uploadQueue: [],

  setCurrentChatId: (id) => set({ currentChatId: id }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  addToUploadQueue: (file) =>
    set((state) => ({ uploadQueue: [...state.uploadQueue, file] })),
  removeFromUploadQueue: (name) =>
    set((state) => ({ uploadQueue: state.uploadQueue.filter((f) => f.name !== name) })),
  clearUploadQueue: () => set({ uploadQueue: [] }),
}));
