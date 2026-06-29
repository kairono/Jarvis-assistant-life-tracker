import type { DataStore } from './DataStore';
import { IndexedDbStore } from './IndexedDbStore';

// ------------------------------------------------------------------ //
//  The single storage entry point for the whole app.                  //
//                                                                     //
//  To migrate to Supabase later, implement SupabaseStore (same        //
//  DataStore interface) and change ONE line here:                     //
//      export const db: DataStore = new SupabaseStore();              //
//  No UI code imports a concrete store — only this `db`.              //
// ------------------------------------------------------------------ //
export const db: DataStore = new IndexedDbStore();

export type { DataStore, Collection, NewRecord } from './DataStore';
