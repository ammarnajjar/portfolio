import { useContext } from 'react';
import { WatchlistContext } from './watchlist-context';

export const useWatchlist = () => {
  const ctx = useContext(WatchlistContext);
  if (!ctx)
    throw new Error('useWatchlist must be used within WatchlistProvider');
  return ctx;
};
