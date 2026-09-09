import { useContext } from 'react';
import { StorageContext } from '../context/StorageContextCore';
import type { StorageContextValue } from '../context/StorageContextCore';

export function useStorage(): StorageContextValue {
  const context = useContext(StorageContext);
  if (!context) {
    throw new Error('useStorage must be used within a StorageProvider');
  }
  return context;
}
