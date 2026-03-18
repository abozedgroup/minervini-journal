import { createContext, useContext, useState, useCallback } from 'react';

const TradeModalContext = createContext(null);

export function TradeModalProvider({ children }) {
  const [open, setOpen] = useState(false);

  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  return (
    <TradeModalContext.Provider value={{ open, openModal, closeModal }}>
      {children}
    </TradeModalContext.Provider>
  );
}

export function useTradeModal() {
  const ctx = useContext(TradeModalContext);
  if (!ctx) {
    return { open: false, openModal: () => {}, closeModal: () => {} };
  }
  return ctx;
}
