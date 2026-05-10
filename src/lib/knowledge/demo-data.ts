import type { KBEntry } from './fs-index'
import { kbEntryId } from './fs-index'
import kbData from '@/generated/kb-data.json'

type StoredEntry = {
  id: string
  path: string
  category: string
  file_name: string
  file_size: number
  modified_at?: string | null
  updated_at?: string | null
}

/**
 * Built-in demo KB (used when MANA_HUB_KNOWLEDGE_ROOT is unset).
 * Ids are regenerated from path so they match file route lookups.
 */
export function getDemoKnowledgeEntries(): KBEntry[] {
  const raw = kbData.entries as StoredEntry[]
  return raw.map(entry => ({
    ...entry,
    id: kbEntryId(entry.path),
    modified_at: entry.modified_at ?? null,
    updated_at: entry.updated_at ?? entry.modified_at ?? null,
  }))
}
