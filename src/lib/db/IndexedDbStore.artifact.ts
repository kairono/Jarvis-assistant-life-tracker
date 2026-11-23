import type { DataStore } from './DataStore';

// Artifact build stand-in for IndexedDbStore (aliased in vite.config.ts).
// The artifact always uses ArtifactDbStore, so this keeps Dexie (~95 KB)
// out of the single-file bundle. It is never constructed there.
export class IndexedDbStore {
  constructor() {
    throw new Error('IndexedDbStore is not available in the artifact build');
  }
}
export type { DataStore };
