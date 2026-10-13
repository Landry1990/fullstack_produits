import { createContext, useContext, useState, type ReactNode } from 'react';

interface OmnisearchContextValue {
  open: boolean;
  setOpen: (open: boolean | ((previous: boolean) => boolean)) => void;
}

const OmnisearchContext = createContext<OmnisearchContextValue | null>(null);

export function OmnisearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <OmnisearchContext.Provider value={{ open, setOpen }}>
      {children}
    </OmnisearchContext.Provider>
  );
}

export function useOmnisearchOpen() {
  const context = useContext(OmnisearchContext);
  if (!context) {
    throw new Error('useOmnisearchOpen must be used within OmnisearchProvider');
  }
  return context;
}
