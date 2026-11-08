/// <reference types="bun" />

import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, test } from 'bun:test'
import {
	clearKboGameListCaches,
	clearKboRosterCache,
	clearKboScheduleCache,
	clearKboStandingsCache,
	fetchKboGame,
	fetchKboRoster,
	fetchKboSchedule,
	getKboGameList,
	getKboStandings,
	isRecentKboDate,
	KboNotFoundError,
	withKboScheduleDetails,
} from './kbo'

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

const fixture = (name: string) =>
	readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8')

/**
 * A fake koreabaseball.com: answers each web service from the fixtures by its form fields, and
 * the register page (a GET shows KT, the postback LG). Records each request.
 */
function fakeKbo() {
	const requests: { path: string; params: URLSearchParams }[] = []
	const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
		const url = new URL(String(input))
		const params = new URLSearchParams(String(init?.body ?? ''))
		requests.push({ path: url.pathname, params })

		// Without the page as referer, the services answer with an error page
		if (url.pathname.startsWith('/ws/') && !new Headers(init?.headers).get('referer')) {
			return new Response('<html>error</html>')
		}

		const file = (() => {
			switch (url.pathname) {
				case '/ws/Schedule.asmx/GetScheduleList': {
					const month = params.get('gameMonth')
					const post = params.get('srIdList') === '3,4,5,7'
					if (post && (month === '10' || month === '11')) {
						return `kbo-schedule-list-postseason-2026-${month}.json`
					}
					if (!post && (month === '07' || month === '10'))
						return `kbo-schedule-list-2026-${month}.json`
					return null
				}
				case '/ws/Schedule.asmx/GetMonthSchedule':
					return 'kbo-month-schedule-2026-07.json'
				case '/ws/Main.asmx/GetKboGameList':
					return `kbo-game-list-${params.get('date')}.json`
				case '/ws/Schedule.asmx/GetScoreBoardScroll':
					return `kbo-scoreboard-${params.get('gameId')}.json`
				case '/ws/Schedule.asmx/GetBoxScoreScroll':
					return `kbo-boxscore-${params.get('gameId')}.json`
				case '/Player/Register.aspx':
					return init?.method === 'POST' ? 'kbo-register-LG-2026.html' : 'kbo-register-2026.html'
			}
		})()

		if (file === null) return Response.json({ rows: [] })
		try {
			// As koreabaseball.com sends it, with a byte order mark
			return new Response(`\uFEFF${fixture(file!)}`)
		} catch {
			return new Response('', { status: 404 })
		}
	}
	return Object.assign(fetcher as unknown as typeof fetch, { requests })
}

describe('getKboSchedule', () => {
	beforeEach(clearKboScheduleCache)

	test('reads every month, the postseason and the All-Star Game', async () => {
		const fetcher = fakeKbo()
		const schedule = await fetchKboSchedule(2026, fetcher)

		expect(fetcher.requests.filter((r) => r.path.endsWith('GetScheduleList'))).toHaveLength(11)
		expect(schedule.allStarDates).toEqual(['2026-07-11'])
		const competitions = new Set(schedule.games.map((game) => game.competition))
		expect([...competitions].sort()).toEqual([
			'all-star',
			'korean-series',
			'playoff',
			'regular',
			'semi-playoff',
			'wild-card',
		])
	})

	test('a season with no games, or out of range, is not found', async () => {
		const empty = (async () => Response.json({ rows: [] })) as unknown as typeof fetch
		await expect(fetchKboSchedule(2026, empty)).rejects.toBeInstanceOf(KboNotFoundError)
		await expect(fetchKboSchedule(2010, fakeKbo())).rejects.toBeInstanceOf(KboNotFoundError)
	})

	test('an error page is an error, not an empty schedule', async () => {
		const errorPage = (async () => new Response('<html>error</html>')) as unknown as typeof fetch
		await expect(fetchKboSchedule(2026, errorPage)).rejects.toThrow('error page')
	})
})

describe('the schedule pages’ details', () => {
	beforeEach(clearKboGameListCaches)

	test('a day’s game list and each game’s scoreboard, and none for days to come', async () => {
		const fetcher = fakeKbo()
		const schedule = await fetchKboSchedule(2026, fakeKbo())
		const games = schedule.games.filter((g) => ['2026-11-07', '2026-11-08'].includes(g.date))

		const detailed = await withKboScheduleDetails(games, { fetcher, today: '2026-11-07' })
		const [ks4, ks5] = detailed
		expect(ks4.summary?.state).toBe('Final')
		expect(ks4.linescore?.teams.home.runs).toBe(10)
		expect(ks5.summary).toBeUndefined()
		expect(fetcher.requests.map((r) => r.path)).toEqual([
			'/ws/Main.asmx/GetKboGameList',
			'/ws/Schedule.asmx/GetScoreBoardScroll',
		])
		// The scoreboard takes the game's series
		expect(fetcher.requests[1].params.get('srId')).toBe('7')
	})

	test('recent days are read again within the minute; past ones are kept', async () => {
		const fetcher = fakeKbo()
		await getKboGameList('2026-11-07', { fetcher, now: 0, today: '2026-11-07' })
		await getKboGameList('2026-11-07', { fetcher, now: 29_000, today: '2026-11-07' })
		await getKboGameList('2026-11-07', { fetcher, now: 31_000, today: '2026-11-07' })
		expect(fetcher.requests).toHaveLength(2)

		await getKboGameList('2026-10-01', { fetcher, now: 0, today: '2026-11-07' })
		await getKboGameList('2026-10-01', { fetcher, now: 86_400_000, today: '2026-11-07' })
		expect(fetcher.requests).toHaveLength(3)

		expect(isRecentKboDate('2026-11-06', '2026-11-07')).toBe(true)
		expect(isRecentKboDate('2026-11-05', '2026-11-07')).toBe(false)
	})
})

describe('fetchKboRoster', () => {
	beforeEach(clearKboRosterCache)

	test("posts back for a team the page doesn't show", async () => {
		const fetcher = fakeKbo()
		const roster = await fetchKboRoster(2913, fetcher)
		expect(roster.teamId).toBe(2913)
		expect(fetcher.requests).toHaveLength(2)
		expect([...fetcher.requests[1].params.values()]).toContain('LG')
	})

	test('a page showing another team is an error', async () => {
		await expect(fetchKboRoster(2911, fakeKbo())).rejects.toThrow("another team's register")
	})

	test('only KBO clubs', async () => {
		await expect(fetchKboRoster(147, fakeKbo())).rejects.toBeInstanceOf(KboNotFoundError)
	})
})

describe('fetchKboGame', () => {
	beforeEach(() => {
		clearKboGameListCaches()
		clearKboRosterCache()
	})

	test('puts together the game list, scoreboard, box score and rosters', async () => {
		const game = await fetchKboGame('20261001NCOB0', fakeKbo())
		expect(game).toMatchObject({
			id: '20261001NCOB0',
			season: 2026,
			competition: 'regular',
			state: 'Final',
			venueKo: '잠실',
			attendance: 23248,
			duration: 204,
			teams: {
				away: { id: 5051, name: 'NC Dinos', runs: 7, hits: 14 },
				home: { id: 2911, name: 'Doosan Bears', runs: 9, hits: 13 },
			},
		})
		expect(game.decisions.win).toEqual({
			player: { nameKo: '타카다', id: '56212' },
			record: '2-1',
		})
		expect(game.decisions.save?.record).toBe('4 SV')
		expect(game.plays?.length).toBeGreaterThan(10)
		expect(game.homeRuns).toHaveLength(1)
		expect(game.umpires).toEqual(['김정국', '김선수', '김성철', '이용혁'])
	})

	test("the postseason's pitchers' records aren't shown", async () => {
		const game = await fetchKboGame('20261107KTSS0', fakeKbo())
		expect(game.competition).toBe('korean-series')
		expect(game.decisions.win?.record).toBeNull()
		expect(game.teams.home.record).toEqual({ wins: 3, losses: 1, ties: 0 })
	})

	test('before the game: no box score', async () => {
		const fetcher = fakeKbo()
		const game = await fetchKboGame('20261108KTSS0', fetcher)
		expect(game.state).toBe('Preview')
		expect(game.box).toBeNull()
		expect(fetcher.requests.some((r) => r.path.endsWith('GetBoxScoreScroll'))).toBe(false)
	})

	test('a game the day does not have, or a bad ID, is not found', async () => {
		await expect(fetchKboGame('20261001LGOB0', fakeKbo())).rejects.toBeInstanceOf(KboNotFoundError)
		await expect(fetchKboGame('nope', fakeKbo())).rejects.toBeInstanceOf(KboNotFoundError)
	})
})
