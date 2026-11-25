import type { Listing } from '../types/listing'

export type RealtimeChange = {
  version: number
  deleted: boolean
  listing?: Listing
}

/**
 * Reconcile a database snapshot with newer in-flight realtime/local changes
 * so stale responses never resurrect deleted rows or revert newer claims.
 */
export function mergeListingsSnapshot(
  snapshotRows: Listing[],
  pendingChanges: Map<string, RealtimeChange>,
  eventVersionAtStart: number
): Listing[] {
  const snapshotById = new Map<string, Listing>(
    snapshotRows.map((listing): [string, Listing] => [listing.id, listing])
  )

  for (const [id, change] of pendingChanges) {
    if (change.version <= eventVersionAtStart) {
      pendingChanges.delete(id)
      continue
    }

    if (change.deleted) {
      snapshotById.delete(id)
    } else if (change.listing) {
      snapshotById.set(id, change.listing)
    }
  }

  return Array.from(snapshotById.values()).sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

