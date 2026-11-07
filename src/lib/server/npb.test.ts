/// <reference types="bun" />

import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, test } from 'bun:test'
import { clearNpbStandingsCache, getNpbStandings, NpbNotFoundError } from './npb'

const html = readFileSync(new URL('../fixtures/npb-std_c-2024.html', import.meta.url), 'utf8')

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

describe('getNpbStandings', () => {
	beforeEach(clearNpbStandingsCache)

	test('fetches both leagues once and serves repeat calls from memory', async () => {
		const fetcher = fakeFetch()
		const options = { fetcher, now: 0, currentSeason: 2026 }

		const [first, second] = await Promise.all([
			getNpbStandings(2024, options),
			getNpbStandings(2024, options),
		])
		await getNpbStandings(2024, { ...options, now: 60 * MINUTE })

		expect(fetcher.calls).toBe(2)
		expect(second).toBe(first)
		expect(first[0].teams).toHaveLength(6)
	})

	test('refetches the current season after 15 minutes, past seasons after a week', async () => {
		const fetcher = fakeFetch()

		await getNpbStandings(2026, { fetcher, now: 0, currentSeason: 2026 })
		await getNpbStandings(2026, { fetcher, now: 14 * MINUTE, currentSeason: 2026 })
		expect(fetcher.calls).toBe(2)
		await getNpbStandings(2026, { fetcher, now: 15 * MINUTE, currentSeason: 2026 })
		expect(fetcher.calls).toBe(4)

		await getNpbStandings(2024, { fetcher, now: 0, currentSeason: 2026 })
		await getNpbStandings(2024, { fetcher, now: 6 * 24 * 60 * MINUTE, currentSeason: 2026 })
		expect(fetcher.calls).toBe(6)
		await getNpbStandings(2024, { fetcher, now: 7 * 24 * 60 * MINUTE, currentSeason: 2026 })
		expect(fetcher.calls).toBe(8)
	})

	test('does not keep upstream failures', async () => {
		const failing = fakeFetch(503)
		const options = { now: 0, currentSeason: 2026 }

		await expect(getNpbStandings(2024, { ...options, fetcher: failing })).rejects.toThrow('503')

		const working = fakeFetch()
		const standings = await getNpbStandings(2024, { ...options, fetcher: working })
		expect(working.calls).toBe(2)
		expect(standings).toHaveLength(2)
	})

	test('keeps "not found" for the TTL', async () => {
		const missing = fakeFetch(404)
		const options = { now: 0, currentSeason: 2026 }

		await expect(getNpbStandings(2027, { ...options, fetcher: missing })).rejects.toBeInstanceOf(
			NpbNotFoundError,
		)

		const working = fakeFetch()
		await expect(getNpbStandings(2027, { ...options, fetcher: working })).rejects.toBeInstanceOf(
			NpbNotFoundError,
		)
		expect(working.calls).toBe(0)
	})
})
