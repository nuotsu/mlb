/// <reference types="bun" />

import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'
import { gameHref, npbGamePk, toMlbScheduleGame } from './npb-game-mlb'
import {
	buildNpbSchedule,
	filterNpbSchedule,
	npbCalendarUrl,
	npbScheduleUrl,
	parseNpbPostseason,
	parseNpbScheduleMonth,
	type NpbScheduleRow,
} from './npb-schedule'

const fixture = (name: string) =>
	readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8')

const july2026 = parseNpbScheduleMonth(fixture('npb-schedule_07_detail-2026'), 2026)
const october2026 = parseNpbScheduleMonth(fixture('npb-schedule_10_detail-2026'), 2026)
/** An archived copy from 2025-07-29, 13:42 JST: that day's probable starters, and later games */
const july2025 = parseNpbScheduleMonth(fixture('npb-schedule_07_detail-2025-0729'), 2025)
const postseason = parseNpbPostseason(fixture('npb-calendar_10-eng-2026'), 2026, 10)

const find = (rows: NpbScheduleRow[], date: string, home: string) =>
	rows.find((row) => row.date === date && row.teams.home.code === home)!

describe('URLs', () => {
	test('pads the month', () => {
		expect(npbScheduleUrl(2026, 6)).toBe('https://npb.jp/games/2026/schedule_06_detail.html')
		expect(npbCalendarUrl(2026, 10)).toBe('https://npb.jp/bis/eng/2026/calendar/index_10.html')
	})
})

describe('parseNpbScheduleMonth', () => {
	test('reads a finished game, home team first', () => {
		expect(find(october2026.rows, '2026-10-08', 't')).toEqual({
			code: 't-s-25',
			date: '2026-10-08',
			teams: {
				home: { id: 341, code: 't', shortNameJa: '阪神', runs: 0, record: null },
				away: { id: 2673, code: 's', shortNameJa: 'ヤクルト', runs: 4, record: null },
			},
			venueJa: '甲子園',
			startTime: '18:00',
			state: 'Final',
			isCancelled: false,
			statusJa: null,
			isTie: false,
			pitchers: { away: null, home: null, win: '中村優', loss: 'ルーカス', save: null },
		})
	})

	test('reads a tie as final', () => {
		const tie = find(october2026.rows, '2026-10-01', 't')
		expect(tie).toMatchObject({ code: 't-g-25', state: 'Final', isTie: true })
		expect(tie.teams.home.runs).toBe(2)
		expect(tie.teams.away.runs).toBe(2)
	})

	test('reads a called-off game', () => {
		expect(find(july2026.rows, '2026-07-01', 't')).toMatchObject({
			code: 't-d-13',
			state: 'Final',
			isCancelled: true,
			statusJa: '中止',
			teams: { home: { runs: null }, away: { runs: null } },
		})
	})

	test('reads probable starters, and games npb.jp has no link for yet', () => {
		expect(find(july2025.rows, '2025-07-29', 'db')).toMatchObject({
			code: null,
			state: 'Preview',
			startTime: '17:45',
			venueJa: '横浜',
			pitchers: { home: '東', away: 'ランバート', win: null, loss: null },
		})
		expect(find(july2025.rows, '2025-07-30', 'd')).toMatchObject({
			code: null,
			state: 'Preview',
			teams: { home: { id: 2798 }, away: { id: 241 } },
			pitchers: { home: null, away: null },
		})
	})

	test('sets All-Star games aside', () => {
		expect(july2026.allStarDates).toEqual(['2026-07-28', '2026-07-29'])
		expect(july2026.rows.every((row) => row.date !== '2026-07-28')).toBe(true)
	})

	test('skips days without games', () => {
		expect(july2026.rows.some((row) => row.date === '2026-07-06')).toBe(false)
	})
})

describe('parseNpbPostseason', () => {
	test('lists the Climax Series and Nippon Series games, home team first', () => {
		expect(postseason.start).toBe('2026-10-10')
		expect(postseason.games.has('1010/g-db')).toBe(true)
		expect(postseason.games.has('1024/db-h')).toBe(true)
		expect(postseason.games.has('1027/h-db')).toBe(true)
		expect(postseason.games.has('1008/t-s')).toBe(false)
		expect(postseason.games.size).toBe(16)
	})

	test('scheduled games too, before they are played', () => {
		// An archived copy from 2025-10-06, before the Climax Series began
		const html = fixture('npb-calendar_10-eng-2025-1006')
		const { start, games } = parseNpbPostseason(html, 2025, 10)
		expect(start).toBe('2025-10-11')
		expect(games.has('1011/db-g')).toBe(true)
		expect(games.has('1011/f-b')).toBe(true)
	})

	test('none in a month without postseason games', () => {
		const html = fixture('npb-calendar_10-eng-2026').replace(/tescheaten/g, 'x')
		expect(parseNpbPostseason(html, 2026, 10)).toEqual({ start: null, games: new Set() })
	})
})

describe('buildNpbSchedule', () => {
	test('drops the postseason', () => {
		const { games } = buildNpbSchedule({
			season: 2026,
			months: [october2026],
			postseason,
		})
		expect(games.at(-1)!.ref).toEqual({ season: 2026, date: '1008', code: 't-s-25' })
		expect(games.every((game) => game.date <= '2026-10-08')).toBe(true)
		expect(games.every((game) => game.linked)).toBe(true)
	})

	test("works out the codes of games npb.jp hasn't linked yet", () => {
		const cutoff = '2026-07-15'
		// The same month as if it were the morning of the cutoff: later games not played or linked
		const upcoming = {
			...july2026,
			rows: july2026.rows.map((row) =>
				row.date < cutoff
					? row
					: {
							...row,
							code: null,
							state: 'Preview' as const,
							isCancelled: false,
							teams: {
								away: { ...row.teams.away, runs: null },
								home: { ...row.teams.home, runs: null },
							},
						},
			),
		}

		const actual = buildNpbSchedule({ season: 2026, months: [july2026] }).games
		const worked = buildNpbSchedule({ season: 2026, months: [upcoming] }).games
		const pair = (code: string) => code.split('-').slice(0, 2).sort().join('-')
		const metBefore = new Set(
			actual.filter((game) => game.date < cutoff).map((game) => pair(game.ref.code)),
		)

		// Called-off games later in the month push the rest back, as npb.jp's later codes show,
		// so compare only up to each pair's first called-off game after the cutoff.
		const calledOff = new Map<string, string>()
		for (const game of actual) {
			const key = pair(game.ref.code)
			if (game.isCancelled && game.date >= cutoff && !calledOff.has(key)) {
				calledOff.set(key, game.date)
			}
		}

		const compared = worked.filter((game, i) => {
			const key = pair(actual[i].ref.code)
			return (
				game.date >= cutoff &&
				metBefore.has(key) &&
				(!calledOff.has(key) || game.date <= calledOff.get(key)!)
			)
		})

		expect(compared.length).toBeGreaterThan(40)
		for (const game of compared) {
			expect(game.linked).toBe(false)
			expect(game.ref.code).toBe(actual[worked.indexOf(game)].ref.code)
		}
	})

	test('a called-off game keeps its number for the makeup game', () => {
		const { games } = buildNpbSchedule({ season: 2026, months: [july2026] })
		const calledOff = games.find((game) => game.ref.code === 't-d-13' && game.isCancelled)!
		expect(calledOff.date).toBe('2026-07-01')
	})

	test("keeps each team's record after every game, ties apart", () => {
		const { games } = buildNpbSchedule({ season: 2026, months: [october2026] })
		const tigers = games.filter((game) => game.teams.home.id === 341 || game.teams.away.id === 341)
		const side = (game: (typeof games)[number]) => (game.teams.home.id === 341 ? 'home' : 'away')

		// 10/1 was a 2-2 tie with the Giants, the Tigers' first October game
		expect(tigers[0].teams.home.record).toEqual({ wins: 0, losses: 0, ties: 1 })
		const last = tigers.at(-1)!
		const { wins, losses, ties } = last.teams[side(last)].record!
		expect(wins + losses + ties).toBe(tigers.filter((game) => !game.isCancelled).length)
	})

	test('collects the All-Star dates', () => {
		expect(
			buildNpbSchedule({ season: 2026, months: [july2026, october2026] }).allStarDates,
		).toEqual(['2026-07-28', '2026-07-29'])
	})
})

describe('filterNpbSchedule', () => {
	const { games } = buildNpbSchedule({ season: 2026, months: [july2026] })

	test('by date range', () => {
		const week = filterNpbSchedule(games, { startDate: '2026-07-07', endDate: '2026-07-12' })
		expect(week.length).toBeGreaterThan(0)
		expect(week.every((game) => game.date >= '2026-07-07' && game.date <= '2026-07-12')).toBe(true)
	})

	test('by team, home or away', () => {
		const tigers = filterNpbSchedule(games, { teamId: 341 })
		expect(tigers.length).toBeGreaterThan(15)
		expect(tigers.every((game) => game.teams.home.id === 341 || game.teams.away.id === 341)).toBe(
			true,
		)
	})
})

describe('toMlbScheduleGame', () => {
	const season = buildNpbSchedule({ season: 2026, months: [july2026, october2026] }).games
	const byCode = (date: string, code: string) =>
		season.find((game) => game.ref.date === date && game.ref.code === code)!

	test('links to our game page, with a unique negative gamePk', () => {
		const pks = new Set(season.map((game) => npbGamePk(game.ref)))
		expect(pks.size).toBe(season.length)
		expect([...pks].every((pk) => pk < 0)).toBe(true)

		const game = toMlbScheduleGame(byCode('1008', 't-s-25'))
		expect(gameHref(game)).toBe('/game/npb/2026/1008/t-s-25')
		expect(game.officialDate).toBe('2026-10-08')
		expect(game.gameDate).toBe('2026-10-08T18:00:00+09:00')
		expect(game.teams.away.isWinner).toBe(true)
		expect(game.teams.home.isWinner).toBe(false)
		expect(game.teams.home.team.name).toBe('Hanshin Tigers')
	})

	test('a tie has no winner, and a called-off game no score', () => {
		const tie = toMlbScheduleGame(byCode('1001', 't-g-25'))
		expect(tie.teams.home.isWinner).toBeUndefined()
		expect(tie.status.detailedState).toBe('Final')

		const calledOff = toMlbScheduleGame(byCode('0701', 't-d-13'))
		expect(calledOff.status.detailedState).toBe('Postponed')
		expect(calledOff.teams.home.score).toBeUndefined()
	})
})
