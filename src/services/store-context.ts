import React from 'react';
import type { AppState } from './store-types';

export const StoreContext = React.createContext<AppState | undefined>(undefined);
