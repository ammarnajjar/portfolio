type UIState = {
  showChart?: boolean;
  showBreakdown?: boolean;
  showTable?: boolean;
  [k: string]: unknown;
};

import storage from './storage';

const STORAGE_KEY = 'ui';

export const readUIState = (): UIState => {
  try {
    return (storage.get(STORAGE_KEY, {}) as UIState) || {};
  } catch (e) {
    void e;
    return {};
  }
};

export const writeUIState = (patch: Partial<UIState>) => {
  try {
    const current = readUIState();
    const merged = { ...current, ...patch };
    storage.set(STORAGE_KEY, merged);
  } catch (e) {
    void e;
  }
};

export default { readUIState, writeUIState };
