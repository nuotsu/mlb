/// <reference types="bun" />

import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, test } from 'bun:test'
import {
	clearNpbGameCache,
	clearNpbRosterCache,
	clearNpbScheduleCache,
	clearNpbStandingsCache,
	getNpbGame,
	getNpbRoster,
	getNpbSchedule,
	getNpbStandings,
	NpbNotFoundError,
	withNpbScheduleLinescores,
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

describe('getNpbGame', () => {
	const ref = { season: 2026, date: '1001', code: 't-g-25' }
	const game = (name: string) => page(`npb-game-2026-1001-t-g-25-${name}`)

	/** The game's pages plus the Giants' roster pages; the Tigers' roster 404s */
	function gameFetch(index = game('index')) {
		const pages: Record<string, string> = {
			...GIANTS_PAGES,
			'https://npb.jp/scores/2026/1001/t-g-25/': index,
			'https://npb.jp/scores/2026/1001/t-g-25/box.html': game('box'),
			'https://npb.jp/scores/2026/1001/t-g-25/playbyplay.html': game('playbyplay'),
		}
		const fetcher = Object.assign(
			async (url: string) => {
				fetcher.calls++
				const html = pages[url]
				return new Response(html ?? '', { status: html ? 200 : 404 })
			},
			{ calls: 0 },
		)
		return fetcher as unknown as typeof fetch & { calls: number }
	}

	beforeEach(() => {
		clearNpbGameCache()
		clearNpbRosterCache()
	})

	test('joins box score, plays and English names from the rosters', async () => {
		const data = await getNpbGame(ref, { fetcher: gameFetch(), today: new Date('2026/11/07') })
		expect(data.box?.away.batters.length).toBeGreaterThan(9)
		expect(data.plays).toHaveLength(24)

		// 丸 (Maru, Yoshihiro) is a Giant; the Tigers' roster couldn't load, so they keep Japanese
		expect(data.names['21425116']).toMatchObject({ short: 'Maru' })
		expect(data.names['71075138']).toBeUndefined()
	})

	test('caches a past game', async () => {
		const fetcher = gameFetch()
		const options = { fetcher, today: new Date('2026/11/07'), now: 0 }
		await getNpbGame(ref, options)
		const calls = fetcher.calls
		await getNpbGame(ref, { ...options, now: 60 * 60_000 })
		expect(fetcher.calls).toBe(calls)
	})

	test('treats games outside the regular season as not found', async () => {
		const fetcher = gameFetch(
			game('index').replace('JERA セ・リーグ公式戦', 'セ・リーグ クライマックスシリーズ'),
		)
		expect(getNpbGame(ref, { fetcher })).rejects.toBeInstanceOf(NpbNotFoundError)
	})

	test('is not found when npb.jp has no such game', async () => {
		const fetcher = gameFetch()
		expect(getNpbGame({ ...ref, code: 'c-d-1' }, { fetcher })).rejects.toBeInstanceOf(
			NpbNotFoundError,
		)
	})
})

/** npb.jp's 2026 schedule pages we have fixtures for; the other months 404 */
const SCHEDULE_PAGES: Record<string, string> = {
	'https://npb.jp/games/2026/schedule_07_detail.html': page('npb-schedule_07_detail-2026'),
	'https://npb.jp/games/2026/schedule_10_detail.html': page('npb-schedule_10_detail-2026'),
	// Lists Nippon Series game 6, which wasn't needed, with no label on the English calendar
	'https://npb.jp/games/2026/schedule_11_detail.html': page('npb-schedule_11_detail-2026'),
	'https://npb.jp/bis/eng/2026/calendar/index_10.html': page('npb-calendar_10-eng-2026'),
}

function fakeScheduleFetch(pages = SCHEDULE_PAGES) {
	const fetcher = Object.assign(
		async (url: string) => {
			fetcher.urls.push(url)
			const html = pages[url]
			return new Response(html ?? '', { status: html ? 200 : 404 })
		},
		{ urls: [] as string[] },
	)
	return fetcher as unknown as typeof fetch & { urls: string[] }
}

describe('getNpbSchedule', () => {
	beforeEach(clearNpbScheduleCache)

	test('reads every month and the postseason calendars, once per season', async () => {
		const fetcher = fakeScheduleFetch()
		const options = { fetcher, now: 0, currentSeason: 2027 }

		const schedule = await getNpbSchedule(2026, options)
		await getNpbSchedule(2026, { ...options, now: 60 * MINUTE })

		expect(fetcher.urls).toHaveLength(11)
		expect(fetcher.urls).toContain('https://npb.jp/games/2026/schedule_03_detail.html')
		expect(fetcher.urls).toContain('https://npb.jp/games/2026/schedule_11_detail.html')
		expect(fetcher.urls).toContain('https://npb.jp/bis/eng/2026/calendar/index_11.html')

		expect(schedule.allStarDates).toEqual(['2026-07-28', '2026-07-29'])
		expect(schedule.games.at(0)!.date).toBe('2026-07-01')
		// The Climax Series and Nippon Series are left out, the unplayed game 6 too
		expect(schedule.games.at(-1)!.ref.code).toBe('t-s-25')
	})

	test('throws NpbNotFoundError when no month has a page, or before 2019', async () => {
		const fetcher = fakeScheduleFetch({})

		await expect(getNpbSchedule(2026, { fetcher, now: 0 })).rejects.toBeInstanceOf(NpbNotFoundError)
		await expect(getNpbSchedule(2018, { fetcher, now: 0 })).rejects.toBeInstanceOf(NpbNotFoundError)
		expect(fetcher.urls).toHaveLength(11)
	})

	test('a failing month fails the season, and is retried', async () => {
		let fail = true
		const fetcher = Object.assign(async (url: string) => {
			if (fail && url.endsWith('schedule_07_detail.html')) {
				return new Response('', { status: 503 })
			}
			const html = SCHEDULE_PAGES[url]
			return new Response(html ?? '', { status: html ? 200 : 404 })
		}) as unknown as typeof fetch

		await expect(getNpbSchedule(2026, { fetcher, now: 0 })).rejects.toThrow('503')
		fail = false
		const schedule = await getNpbSchedule(2026, { fetcher, now: 1 })
		expect(schedule.games.length).toBeGreaterThan(0)
	})
})

describe('withNpbScheduleLinescores', () => {
	test("reads each game's page up to today, leaving null where it can't", async () => {
		const pages: Record<string, string> = {
			'https://npb.jp/scores/2026/1001/t-g-25/': page('npb-game-2026-1001-t-g-25-index'),
		}
		const fetcher = fakeScheduleFetch(pages)
		const { games } = await getNpbSchedule(2026, {
			fetcher: fakeScheduleFetch(),
			now: 0,
			currentSeason: 2027,
		})
		const october = games.filter((game) => game.date >= '2026-10-01' && game.date <= '2026-10-02')

		const result = await withNpbScheduleLinescores(october, { fetcher, today: '2026-10-01' })

		const tie = result.find((game) => game.ref.code === 't-g-25')!
		expect(tie.linescore?.innings).toHaveLength(12)
		// Read, but npb.jp had no page for it
		expect(result.find((game) => game.ref.code === 'c-d-25')!.linescore).toBeNull()
		// After today: not read
		expect(
			result.filter((game) => game.date > '2026-10-01').every((game) => !('linescore' in game)),
		).toBe(true)
		expect(fetcher.urls.every((url) => url.includes('/1001/'))).toBe(true)
		// The schedule's own games are left as they were
		expect(october.every((game) => !('linescore' in game))).toBe(true)
	})
})
