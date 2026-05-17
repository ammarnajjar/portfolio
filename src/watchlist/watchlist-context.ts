import React from 'react';
import type { WatchlistState } from './watchlist-types';

export const WatchlistContext = React.createContext<WatchlistState | undefined>(
  undefined,
);
