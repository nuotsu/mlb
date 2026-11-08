/// <reference types="bun" />

import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'
import { parseKboGameList, parseKboScoreboard } from './kbo-game'
import { toMlbScheduleFeed, toMlbScheduleGame, toMlbScheduleLinescore } from './kbo-game-mlb'
import {
	buildKboSchedule,
	currentKboScheduleGame,
	filterKboSchedule,
	kboGameId,
	parseKboAllStar,
	parseKboScheduleList,
	withKboSportId,
} from './kbo-schedule'
import { gameHref } from './npb-game-mlb'

const json = (name: string) =>
	JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))

const july = parseKboScheduleList(json('kbo-schedule-list-2026-07'), 2026)
const october = parseKboScheduleList(json('kbo-schedule-list-2026-10'), 2026)
const postseason = [
	...parseKboScheduleList(json('kbo-schedule-list-postseason-2026-10'), 2026, true),
	...parseKboScheduleList(json('kbo-schedule-list-postseason-2026-11'), 2026, true),
]
const allStar = parseKboAllStar(json('kbo-month-schedule-2026-07'))

const schedule = buildKboSchedule({
	season: 2026,
	rows: [...july, ...october, ...postseason, ...allStar],
})
const game = (id: string) => schedule.games.find((g) => g.id === id)!

describe('parseKboScheduleList', () => {
	test('a played game: away team first, score, venue and link', () => {
		expect(october[0]).toEqual({
			id: '20261001NCOB0',
			competition: 'regular',
			date: '2026-10-01',
			teams: {
				away: { id: 5051, code: 'NC', nameKo: 'NC', runs: 7, record: null },
				home: { id: 2911, code: 'OB', nameKo: '두산', runs: 9, record: null },
			},
			venueKo: '잠실',
			startTime: '18:30',
			state: 'Final',
			isCancelled: false,
			cancelReasonKo: null,
			isTie: false,
		})
		// Each day's games carry its date, not just the first
		expect(new Set(october.map((row) => row.date)).size).toBeGreaterThan(5)
		expect(october.every((row) => row.id)).toBe(true)
	})

	test('called-off games: no link, the reason, and no score', () => {
		const cancelled = july.filter((row) => row.isCancelled)
		expect(cancelled).toHaveLength(8)
		expect(cancelled[0]).toMatchObject({
			id: null,
			date: '2026-07-05',
			state: 'Final',
			cancelReasonKo: '그라운드사정',
			teams: { away: { nameKo: '한화', runs: null }, home: { nameKo: 'LG', runs: null } },
		})
	})

	test('the postseason: rounds, days off left out, and games still to come', () => {
		expect(postseason.map((row) => row.competition)).toEqual([
			'wild-card',
			...Array(3).fill('semi-playoff'),
			...Array(5).fill('playoff'),
			...Array(7).fill('korean-series'),
		])
		const ks5 = postseason.find((row) => row.date === '2026-11-08')!
		// A preview link (프리뷰) doesn't make it a reviewed (리뷰), finished game
		expect(ks5).toMatchObject({ id: '20261108KTSS0', state: 'Preview' })
		expect(ks5.teams.away.runs).toBeNull()
	})

	test('ties', () => {
		const ties = [...july, ...october].filter((row) => row.isTie)
		for (const row of ties) expect(row.teams.away.runs).toBe(row.teams.home.runs)
	})
})

describe('parseKboAllStar', () => {
	test('the All-Star Game from the calendar', () => {
		expect(allStar).toHaveLength(1)
		expect(allStar[0]).toMatchObject({
			id: '20260711WEEA0',
			competition: 'all-star',
			date: '2026-07-11',
			state: 'Final',
			teams: { away: { id: -11, runs: 10 }, home: { id: -12, runs: 2 } },
		})
	})
})

describe('buildKboSchedule', () => {
	test('games in date order, with the All-Star date', () => {
		const dates = schedule.games.map((g) => g.date)
		expect(dates).toEqual([...dates].sort())
		expect(schedule.allStarDates).toEqual(['2026-07-11'])
	})

	test('called-off games get the ID koreabaseball.com would give them', () => {
		expect(game('20260705HHLG0')).toMatchObject({ isCancelled: true, linked: false })
		expect(kboGameId('2026-07-22', 'OB', 'KT')).toBe('20260722OBKT0')
		expect(kboGameId('2026-07-22', 'OB', 'KT', 2)).toBe('20260722OBKT2')
	})

	test('records: a postseason round counts on its own', () => {
		expect(game('20261107KTSS0').teams).toMatchObject({
			away: { record: { wins: 1, losses: 3, ties: 0 } },
			home: { record: { wins: 3, losses: 1, ties: 0 } },
		})
		expect(game('20261107KTSS0').series).toEqual({
			number: 4,
			total: 7,
			homeWins: 3,
			awayWins: 1,
		})
		expect(game('20261020HTLG0').series).toMatchObject({ number: 3, total: 3 })
		expect(game('20260711WEEA0').teams.away.record).toBeNull()
	})

	test('regular season series', () => {
		const series = schedule.games.filter((g) => g.competition === 'regular')
		for (const g of series) {
			expect(g.series.number).toBeGreaterThan(0)
			expect(g.series.number).toBeLessThanOrEqual(g.series.total)
		}
	})

	test('filters by dates and team', () => {
		const day = filterKboSchedule(schedule.games, {
			startDate: '2026-10-01',
			endDate: '2026-10-01',
		})
		expect(day.map((g) => g.id)).toContain('20261001NCOB0')
		const samsung = filterKboSchedule(schedule.games, { teamId: 2914 })
		for (const g of samsung) expect([g.teams.away.id, g.teams.home.id]).toContain(2914)
	})

	test('KBO is offered on the schedule from 2015', () => {
		expect(withKboSportId([1, 11], 2026)).toEqual([1, 11, 32])
		expect(withKboSportId([1, 32], 2026)).toEqual([1, 32])
		expect(withKboSportId([1], 2010)).toEqual([1])
	})
})

describe('the MLB game card', () => {
	const scheduled = game('20261107KTSS0')
	const [summary] = parseKboGameList(json('kbo-game-list-20261107'))
	const linescore = parseKboScoreboard(json('kbo-scoreboard-20261107KTSS0'))
	const detailed = { ...scheduled, summary, linescore }

	test('a schedule game in the Stats API’s shape, linking to our game page', () => {
		const mlb = toMlbScheduleGame(detailed)
		expect(mlb).toMatchObject({
			gameType: 'W',
			description: 'Korean Series Game 4',
			gameDate: '2026-11-07T14:00:00+09:00',
			officialDate: '2026-11-07',
			status: { abstractGameState: 'Final', detailedState: 'Final' },
			teams: {
				away: { team: { id: 5050, name: 'KT Wiz' }, score: 5, isWinner: false },
				home: { team: { id: 2914, name: 'Samsung Lions' }, score: 10, isWinner: true },
			},
		})
		expect(gameHref(mlb)).toBe('/game/kbo/20261107KTSS0')
	})

	test('the linescore and stand-in feed', () => {
		const mlb = toMlbScheduleGame(detailed)
		const line = toMlbScheduleLinescore(detailed)
		expect(line.innings).toHaveLength(9)
		expect(line.scheduledInnings).toBe(9)
		expect(toMlbScheduleFeed(mlb, line).liveData.linescore).toBe(line)
		expect(toMlbScheduleLinescore(scheduled).innings).toEqual([])
	})

	test('a called-off game is postponed, for rain', () => {
		const rainedOut = game('20260722NCLG0')
		const mlb = toMlbScheduleGame(rainedOut)
		expect(mlb.status).toMatchObject({ detailedState: 'Postponed', reason: 'Rain' })
		expect(mlb.teams.away.score).toBeUndefined()
	})

	test('the game list brings a schedule game up to date', () => {
		const ks5 = game('20261108KTSS0')
		const [preview] = parseKboGameList(json('kbo-game-list-20261108'))
		expect(currentKboScheduleGame({ ...ks5, summary: preview })).toMatchObject({
			state: 'Preview',
			venueKo: '대구',
			startTime: '14:00',
		})
	})
})
