/// <reference types="bun" />

import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, test } from 'bun:test'
import {
	clearNpbRosterCache,
	clearNpbStandingsCache,
	getNpbRoster,
	getNpbStandings,
	NpbNotFoundError,
} from './npb'

const html = readFileSync(new URL('../fixtures/npb-std_c-2024.html', import.meta.url), 'utf8')
const page = (name: string) =>
	readFileSync(new URL(`../fixtures/${name}.html`, import.meta.url), 'utf8')

/** npb.jp's pages for the Giants, by URL; anything else 404s. */
const GIANTS_PAGES: Record<string, string> = {
	'https://npb.jp/bis/eng/teams/rst_g.html': page('npb-rst_g-2026'),
	'https://npb.jp/bis/teams/rst_g.html': page('npb-rst_g-ja-2026'),
	'https://npb.jp/bis/2026/stats/idf1_g.html': page('npb-idf1_g-2026'),
	'https://npb.jp/bis/2026/stats/idf2_g.html': page('npb-idf2_g-2026'),
}

/** A fake `fetch` over {@link GIANTS_PAGES}, counting calls; `failing` URLs answer 503. */
function fakeNpbFetch(failing: (url: string) => boolean = () => false) {
	const fetcher = Object.assign(
		async (url: string) => {
			fetcher.calls++
			if (failing(url)) return new Response('', { status: 503 })
			const html = GIANTS_PAGES[url]
			return new Response(html ?? '', { status: html ? 200 : 404 })
		},
		{ calls: 0 },
	)
	return fetcher as unknown as typeof fetch & { calls: number }
}

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

describe('getNpbRoster', () => {
	beforeEach(clearNpbRosterCache)

	test('merges all four pages and refetches after 15 minutes', async () => {
		const fetcher = fakeNpbFetch()

		const [first, second] = await Promise.all([
			getNpbRoster(241, { fetcher, now: 0 }),
			getNpbRoster(241, { fetcher, now: 0 }),
		])
		expect(second).toBe(first)
		expect(fetcher.calls).toBe(4)
		expect(first.manager?.nameJa).toBe('阿部 慎之助')
		expect(first.players.some(({ position }) => position === 'SS')).toBe(true)

		await getNpbRoster(241, { fetcher, now: 14 * MINUTE })
		expect(fetcher.calls).toBe(4)
		await getNpbRoster(241, { fetcher, now: 15 * MINUTE })
		expect(fetcher.calls).toBe(8)
	})

	test('shows the roster without the extra pages when they fail', async () => {
		const fetcher = fakeNpbFetch((url) => !url.includes('/eng/'))
		const roster = await getNpbRoster(241, { fetcher, now: 0 })

		expect(roster.players.length).toBeGreaterThan(0)
		expect(roster.players.every(({ nameJa }) => nameJa === null)).toBe(true)
		expect(roster.players.every(({ position, group }) => position === group)).toBe(true)
	})

	test('rejects non-NPB teams without fetching', async () => {
		const fetcher = fakeNpbFetch()
		await expect(getNpbRoster(119, { fetcher, now: 0 })).rejects.toBeInstanceOf(NpbNotFoundError)
		expect(fetcher.calls).toBe(0)
	})

	test('does not keep upstream failures', async () => {
		await expect(getNpbRoster(241, { fetcher: fakeNpbFetch(() => true), now: 0 })).rejects.toThrow(
			'503',
		)

		const working = fakeNpbFetch()
		await getNpbRoster(241, { fetcher: working, now: 0 })
		expect(working.calls).toBe(4)
	})
})
