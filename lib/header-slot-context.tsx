'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface HeaderSlotContextType {
  slot: ReactNode;
  setSlot: (node: ReactNode) => void;
}

const HeaderSlotContext = createContext<HeaderSlotContextType>({ slot: null, setSlot: () => {} });

export function HeaderSlotProvider({ children }: { children: ReactNode }) {
  const [slot, setSlotState] = useState<ReactNode>(null);
  const setSlot = useCallback((node: ReactNode) => setSlotState(node), []);
  return (
    <HeaderSlotContext.Provider value={{ slot, setSlot }}>
      {children}
    </HeaderSlotContext.Provider>
  );
}

export function useHeaderSlot() {
  return useContext(HeaderSlotContext);
}
