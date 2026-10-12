import type { SavedState } from './projectState.ts';
import { supabase } from './supabase.ts';

export type PuzzleType = 'ws' | 'scramble';

export interface ProjectSummary {
  id: string;
  name: string;
  puzzle_type: PuzzleType;
  updated_at: string;
  /** Set only for projects in the trash. */
  deleted_at: string | null;
}

function client() {
  if (!supabase) throw new Error('Accounts are not available in this build.');
  return supabase;
}

/**
 * Active projects (newest edit first), or the trash (most recently deleted first).
 * The saved state is fetched separately when a project is opened.
 */
export async function listProjects(trash = false): Promise<ProjectSummary[]> {
  const base = client().from('projects').select('id, name, puzzle_type, updated_at, deleted_at');
  const { data, error } = trash
    ? await base.not('deleted_at', 'is', null).order('deleted_at', { ascending: false })
    : await base.is('deleted_at', null).order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProjectSummary[];
}

export async function loadProject(id: string): Promise<{ name: string; state: unknown }> {
  const { data, error } = await client().from('projects').select('name, state').eq('id', id).is('deleted_at', null).single();
  if (error) throw new Error(error.message);
  return data as { name: string; state: unknown };
}

/** Updates the project when `id` is given and still active, otherwise creates a new one. Returns its id. */
export async function saveProject(input: { id: string | null; ownerId: string; name: string; type: PuzzleType; state: SavedState }): Promise<string> {
  const db = client();
  if (input.id) {
    const { data, error } = await db
      .from('projects')
      .update({ name: input.name, puzzle_type: input.type, state: input.state })
      .eq('id', input.id)
      .is('deleted_at', null)
      .select('id');
    if (error) throw new Error(error.message);
    if (data && data.length > 0) return input.id;
  }
  const { data, error } = await db
    .from('projects')
    .insert({ owner_id: input.ownerId, name: input.name, puzzle_type: input.type, state: input.state })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

/** Moves projects to the trash (soft delete). They can be restored until emptied from there. */
export async function trashProjects(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await client().from('projects').update({ deleted_at: new Date().toISOString() }).in('id', ids).is('deleted_at', null);
  if (error) throw new Error(error.message);
}

/** Takes projects out of the trash. */
export async function restoreProjects(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await client().from('projects').update({ deleted_at: null }).in('id', ids).not('deleted_at', 'is', null);
  if (error) throw new Error(error.message);
}

/** Deletes for good. The database only allows this for projects already in the trash. */
export async function purgeProjects(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await client().from('projects').delete().in('id', ids).not('deleted_at', 'is', null);
  if (error) throw new Error(error.message);
}
