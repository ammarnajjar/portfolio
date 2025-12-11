type State = Record<string, unknown>;
const ROOT_KEY = 'portfolio_state';

export const readState = (): State => {
  try {
    const raw = localStorage.getItem(ROOT_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as State;
  } catch (e) {
    void e;
    return {};
  }
};

export const writeState = (state: State) => {
  try {
    localStorage.setItem(ROOT_KEY, JSON.stringify(state));
  } catch (e) {
    void e;
  }
};

export const get = <T = unknown>(key: string, defaultValue?: T): T | undefined => {
  const s = readState();
  if (s[key] === undefined) return defaultValue;
  return s[key] as T;
};

export const set = (key: string, value: unknown) => {
  const s = readState();
  s[key] = value;
  writeState(s);
};

export const remove = (key: string) => {
  const s = readState();
  if (s[key] !== undefined) {

    delete s[key];
    writeState(s);
  }
};

export default { readState, writeState, get, set, remove };
