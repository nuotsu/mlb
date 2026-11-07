/**
 * An in-memory cache of promises, shared by concurrent callers. For upstream sites with no CDN of
 * their own in front of us: page renders call our API routes in-process, which skips our CDN, so
 * every uncached page URL (`?league=`, `?sort=`, …) would otherwise hit the upstream site.
 *
 * A rejected load is dropped so the next call retries, unless `keepError` says it won't change
 * within the TTL (e.g. "no such season").
 */
export function createMemoryCache<K, V>({
	max = 50,
	keepError = () => false,
}: {
	/** Oldest entries go first past this; it only guards against a flood of odd keys */
	max?: number
	keepError?: (error: unknown) => boolean
} = {}) {
	const entries = new Map<K, { expires: number; value: Promise<V> }>()

	return {
		get(key: K, ttl: number, load: () => Promise<V>, now = Date.now()): Promise<V> {
			const hit = entries.get(key)
			if (hit && hit.expires > now) return hit.value

			const value = load()

			entries.delete(key)
			if (entries.size >= max) entries.delete(entries.keys().next().value!)
			entries.set(key, { expires: now + ttl, value })

			value.catch((e) => {
				if (!keepError(e) && entries.get(key)?.value === value) entries.delete(key)
			})

			return value
		},

		clear() {
			entries.clear()
		},
	}
}

const MINUTE_MS = 60_000

/** Matches `cacheControlForSeasonPage`: 15 min for the current season, a week for past ones. */
export const CURRENT_SEASON_TTL_MS = 15 * MINUTE_MS
export const PAST_SEASON_TTL_MS = 7 * 24 * 60 * MINUTE_MS
