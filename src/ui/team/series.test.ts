/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import {
	groupSeries,
	monthWeeks,
	predictStarters,
	seasonMonths,
	toTeamGames,
	weekSegments,
	type TeamGame,
} from './series'

const TEAM = 119
const team = (id: number) => ({ id, name: `Team ${id}` }) as MLB.Team
const person = (id: number) => ({ id, fullName: `Pitcher ${id}` }) as MLB.Person

function game(
	date: string,
	opponent: number,
	{
		isHome = true,
		gameType = 'R',
		state = 'Final',
		won,
		pitcher,
		gamePk = Number(date.replace(/-/g, '')) * 10 + opponent,
	}: {
		isHome?: boolean
		gameType?: string
		state?: string
		won?: boolean
		pitcher?: number
		gamePk?: number
	} = {},
) {
	const us = {
		team: team(TEAM),
		score: state === 'Final' ? (won ? 5 : 2) : undefined,
		isWinner: state === 'Final' ? won : undefined,
		probablePitcher: pitcher ? person(pitcher) : undefined,
	}
	const them = {
		team: team(opponent),
		score: state === 'Final' ? 3 : undefined,
		isWinner: state === 'Final' ? !won : undefined,
	}

	return {
		date,
		games: [
			{
				gamePk,
				gameDate: `${date}T23:10:00Z`,
				gameType,
				status: {
					detailedState: state,
					abstractGameState: ['Final', 'Live'].includes(state) ? state : 'Preview',
				},
				teams: isHome ? { home: us, away: them } : { home: them, away: us },
			},
		],
	} as unknown as MLB.ScheduleDate
}

const games = (...dates: MLB.ScheduleDate[]) => toTeamGames({ dates }, TEAM)

describe('toTeamGames', () => {
	test("reads the game from the team's side", () => {
		const [home] = games(game('2025-04-01', 135, { won: true }))
		expect(home).toMatchObject({
			isHome: true,
			opponent: { id: 135 },
			state: 'final',
			teamScore: 5,
			opponentScore: 3,
			didWin: true,
		})

		const [away] = games(game('2025-04-02', 135, { isHome: false, won: false }))
		expect(away).toMatchObject({ isHome: false, teamScore: 2, opponentScore: 3, didWin: false })
	})

	test('leaves scores and results off games not played', () => {
		const [ppd, upcoming] = games(
			game('2025-04-01', 135, { state: 'Postponed' }),
			game('2025-04-02', 135, { state: 'Scheduled' }),
		)
		expect(ppd).toMatchObject({ state: 'postponed', teamScore: null, didWin: null })
		expect(upcoming).toMatchObject({ state: 'preview', teamScore: null, didWin: null })
	})
})

describe('groupSeries', () => {
	test('groups back-to-back games against one opponent in one park', () => {
		const series = groupSeries(
			games(
				game('2025-04-01', 135, { won: true }),
				game('2025-04-02', 135, { won: false }),
				game('2025-04-03', 135, { won: true }),
				game('2025-04-04', 137, { isHome: false }),
				game('2025-04-05', 137, { isHome: false }),
			),
		)

		expect(series.map((s) => [s.opponent.id, s.startDate, s.endDate, s.games.length])).toEqual([
			[135, '2025-04-01', '2025-04-03', 3],
			[137, '2025-04-04', '2025-04-05', 2],
		])
		expect(series[0]).toMatchObject({ wins: 2, losses: 1 })
	})

	test('splits the same opponent across ballparks or after days apart', () => {
		const series = groupSeries(
			games(
				game('2025-04-01', 135),
				game('2025-04-02', 135, { isHome: false }),
				game('2025-06-10', 135, { isHome: false }),
			),
		)
		expect(series).toHaveLength(3)
	})

	test('keeps a postponement and its doubleheader makeup in one series', () => {
		const series = groupSeries(
			games(
				game('2024-05-27', 121, { isHome: false, state: 'Postponed', gamePk: 1 }),
				game('2024-05-28', 121, { isHome: false, gamePk: 2 }),
				game('2024-05-28', 121, { isHome: false, gamePk: 1 }),
				game('2024-05-29', 121, { isHome: false, gamePk: 3 }),
			),
		)
		expect(series).toHaveLength(1)
		expect(series[0].games).toHaveLength(4)
	})

	test('keeps a postseason series across travel days and ballparks', () => {
		const series = groupSeries(
			games(
				game('2025-10-04', 143, { gameType: 'D', isHome: false }),
				game('2025-10-06', 143, { gameType: 'D', isHome: false }),
				game('2025-10-08', 143, { gameType: 'D' }),
				game('2025-10-13', 158, { gameType: 'L', isHome: false }),
			),
		)
		expect(series.map((s) => [s.gameType, s.games.length])).toEqual([
			['D', 3],
			['L', 1],
		])
	})
})

describe('predictStarters', () => {
	test('walks the rotation on from the last start', () => {
		const predicted = predictStarters(
			games(
				game('2025-04-01', 135, { pitcher: 1 }),
				game('2025-04-02', 135, { pitcher: 2 }),
				game('2025-04-03', 135, { pitcher: 3 }),
				game('2025-04-04', 137, { state: 'Scheduled' }),
				game('2025-04-05', 137, { state: 'Scheduled' }),
			),
		)

		expect(predicted.slice(3).map((g) => [g.pitcher?.id, g.predicted])).toEqual([
			[1, true],
			[2, true],
		])
	})

	test('re-syncs to an announced starter', () => {
		const predicted = predictStarters(
			games(
				game('2025-04-01', 135, { pitcher: 1 }),
				game('2025-04-02', 135, { pitcher: 2 }),
				game('2025-04-03', 135, { pitcher: 3 }),
				game('2025-04-04', 137, { state: 'Scheduled', pitcher: 2 }),
				game('2025-04-05', 137, { state: 'Scheduled' }),
			),
		)

		expect(predicted.slice(3).map((g) => [g.pitcher?.id, g.predicted])).toEqual([
			[2, false],
			[3, true],
		])
	})

	test('predicts nothing without a rotation', () => {
		const upcoming = games(game('2025-04-04', 137, { state: 'Scheduled' }))
		expect(predictStarters(upcoming)).toEqual(upcoming)
	})
})

describe('seasonMonths', () => {
	test('spans the first through the last game, across the new year', () => {
		const months = seasonMonths([{ date: '2025-10-28' }, { date: '2026-02-01' }] as TeamGame[])
		expect(months).toEqual(['2025-10', '2025-11', '2025-12', '2026-01', '2026-02'])
	})

	test('is empty without games', () => {
		expect(seasonMonths([])).toEqual([])
	})
})

describe('monthWeeks', () => {
	test('lays the month out Monday first', () => {
		// September 2025 starts on a Monday and has 30 days
		const weeks = monthWeeks('2025-09')
		expect(weeks).toHaveLength(5)
		expect(weeks[0][0]).toBe('2025-09-01')
		expect(weeks.at(-1)).toEqual(['2025-09-29', '2025-09-30', null, null, null, null, null])
	})

	test('pads the first week with the previous month', () => {
		// October 2025 starts on a Wednesday
		expect(monthWeeks('2025-10')[0].slice(0, 3)).toEqual([null, null, '2025-10-01'])
	})
})

describe('weekSegments', () => {
	const series = groupSeries(
		games(
			game('2025-09-26', 135),
			game('2025-09-27', 135),
			game('2025-09-28', 135),
			game('2025-09-29', 137),
			game('2025-09-30', 137),
			game('2025-10-01', 137),
		),
	)

	test('bands a series across the days it covers', () => {
		const [week] = monthWeeks('2025-09').slice(3) // Sep 22-28
		const [segment] = weekSegments(week, series)
		expect(segment).toMatchObject({
			column: 5,
			span: 3,
			continuesBefore: false,
			continuesAfter: false,
		})
	})

	test('leaves the end open where a series runs past the month', () => {
		const week = monthWeeks('2025-09').at(-1)!
		const [segment] = weekSegments(week, series)
		expect(segment).toMatchObject({ column: 1, span: 2, continuesAfter: true })

		const [next] = weekSegments(monthWeeks('2025-10')[0], series)
		expect(next).toMatchObject({ column: 3, span: 1, continuesBefore: true })
	})
})
