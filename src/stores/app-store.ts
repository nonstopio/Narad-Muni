import { create } from "zustand";

interface AppStore {
  selectedDate: Date | null;
  setSelectedDate: (date: Date | null) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  selectedDate: null,
  setSelectedDate: (date) => set({ selectedDate: date }),
}));
