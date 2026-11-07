/// <reference types="bun" />

import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, test } from 'bun:test'
import { clearKboStandingsCache, getKboStandings, KboNotFoundError } from './kbo'

const html = readFileSync(
	new URL('../fixtures/kbo-team-rank-daily-2026.html', import.meta.url),
	'utf8',
)

/** A fake `fetch` that counts calls and answers with `status` (the fixture page on 200). */
function fakeFetch(status = 200) {
	const fetcher = Object.assign(
		async () => {
			fetcher.calls++
			return new Response(status === 200 ? html : '', { status })
		},
		{ calls: 0 },
	)
	return fetcher as unknown as typeof fetch & { calls: number }
}

const MINUTE = 60_000

describe('getKboStandings', () => {
	beforeEach(clearKboStandingsCache)

	test('fetches the page once per 15 minutes', async () => {
		const fetcher = fakeFetch()

		const [first, second] = await Promise.all([
			getKboStandings(2026, { fetcher, now: 0 }),
			getKboStandings(2026, { fetcher, now: 0 }),
		])
		await getKboStandings(2026, { fetcher, now: 14 * MINUTE })
		expect(fetcher.calls).toBe(1)
		expect(second).toBe(first)
		expect(first.teams).toHaveLength(10)

		await getKboStandings(2026, { fetcher, now: 15 * MINUTE })
		expect(fetcher.calls).toBe(2)
	})

	test('only has the season the page shows', async () => {
		const fetcher = fakeFetch()

		await expect(getKboStandings(2025, { fetcher, now: 0 })).rejects.toBeInstanceOf(
			KboNotFoundError,
		)
		// Seasons after this year don't fetch at all
		await expect(getKboStandings(9999, { fetcher, now: 0 })).rejects.toBeInstanceOf(
			KboNotFoundError,
		)
		expect(fetcher.calls).toBe(1)
	})

	test('does not keep upstream failures', async () => {
		await expect(getKboStandings(2026, { fetcher: fakeFetch(503), now: 0 })).rejects.toThrow('503')

		const working = fakeFetch()
		await getKboStandings(2026, { fetcher: working, now: 0 })
		expect(working.calls).toBe(1)
	})
})
