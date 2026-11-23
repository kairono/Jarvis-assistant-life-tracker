import type { DataStore } from './DataStore';
import { IndexedDbStore } from './IndexedDbStore';
import { ArtifactDbStore } from './ArtifactDbStore';
import { IS_ARTIFACT } from '../runtime';

// ------------------------------------------------------------------ //
//  The single storage entry point for the whole app.                  //
//  Local dev → IndexedDB. Published claude.ai artifact → the          //
//  artifact's own database (readable/writable by Claude from chat).   //
//  No UI code imports a concrete store — only this `db`.              //
// ------------------------------------------------------------------ //
export const artifactStore: ArtifactDbStore | null = IS_ARTIFACT ? new ArtifactDbStore() : null;
export const db: DataStore = artifactStore ?? new IndexedDbStore();

export type { DataStore, Collection, NewRecord } from './DataStore';
