import React, { createContext, useContext, useMemo, useState } from 'react';

interface PrivacyCtx {
  hidden: boolean;
  toggle: () => void;
}

const Ctx = createContext<PrivacyCtx>({ hidden: false, toggle: () => {} });

// PRD SEC-08 / brief §7.6: privacy mode hides amounts on screen (handy on the
// metro). Kept in memory, so the app always reopens with amounts visible.
export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const value = useMemo(
    () => ({ hidden, toggle: () => setHidden(h => !h) }),
    [hidden],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePrivacy = () => useContext(Ctx);
