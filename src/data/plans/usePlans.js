// React binding of the plan store: const snap = usePlans();  → { status, plans, references, capabilities, storage, … } (re-renders on every change of the cache).
import { useSyncExternalStore } from 'react';
import { getSnapshot, subscribe } from './planStore.js';

export const usePlans = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
