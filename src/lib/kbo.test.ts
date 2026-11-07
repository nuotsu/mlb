/// <reference types="bun" />

import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'
import {
	KBO_TEAMS,
	parseKboHeadToHead,
	parseKboHomeRoad,
	parseKboLastTen,
	parseKboStandings,
	parseKboStreak,
} from './kbo'

const html = readFileSync(
	new URL('./fixtures/kbo-team-rank-daily-2026.html', import.meta.url),
	'utf8',
)

describe('record parsers', () => {
	test('home/road records are wins-ties-losses', () => {
		expect(parseKboHomeRoad('45-2-24')).toEqual({ wins: 45, losses: 24, ties: 2 })
		expect(parseKboHomeRoad('')).toBeNull()
	})

	test('head-to-head records are wins-losses-ties', () => {
		expect(parseKboHeadToHead('7-9-0')).toEqual({ wins: 7, losses: 9, ties: 0 })
		expect(parseKboHeadToHead('■')).toBeNull()
	})

	test('last 10 reads 승 (win), 무 (tie), 패 (loss)', () => {
		expect(parseKboLastTen('9승1무0패')).toEqual({ wins: 9, losses: 0, ties: 1 })
		expect(parseKboLastTen('-')).toBeNull()
	})

	test('streaks become MLB-style codes', () => {
		expect(parseKboStreak('10승')).toBe('W10')
		expect(parseKboStreak('4패')).toBe('L4')
		expect(parseKboStreak('1무')).toBe('T1')
		expect(parseKboStreak('')).toBeNull()
	})
})

describe('parseKboStandings', () => {
	const standings = parseKboStandings(html)

	test('reads the date and season', () => {
		expect(standings.season).toBe(2026)
		expect(standings.date).toBe('2026-10-30')
		expect(standings.teams).toHaveLength(10)
	})

	test('reads the leader row', () => {
		expect(standings.teams[0]).toMatchObject({
			rank: 1,
			nameKo: 'KT',
			id: 5050,
			name: 'KT Wiz',
			teamName: 'Wiz',
			abbreviation: 'KTW',
			games: 144,
			wins: 90,
			losses: 49,
			ties: 5,
			pct: '.647',
			gamesBack: null,
			lastTen: { wins: 9, losses: 0, ties: 1 },
			streak: 'W10',
			home: { wins: 45, losses: 24, ties: 2 },
			road: { wins: 45, losses: 25, ties: 3 },
		})
	})

	test('home and road add up to the overall record', () => {
		for (const team of standings.teams) {
			expect(team.home!.wins + team.road!.wins).toBe(team.wins)
			expect(team.home!.losses + team.road!.losses).toBe(team.losses)
			expect(team.home!.ties + team.road!.ties).toBe(team.ties)
		}
	})

	test('reads games back as numbers', () => {
		const samsung = standings.teams[1]
		expect(samsung.nameKo).toBe('삼성')
		expect(samsung.gamesBack).toBe(8)
		expect(standings.teams.find((t) => t.nameKo === 'KIA')?.gamesBack).toBe(12.5)
	})

	test('maps every team to an MLB Stats API team', () => {
		expect(standings.teams.every((t) => t.id !== null)).toBe(true)
		expect(new Set(standings.teams.map((t) => t.id)).size).toBe(Object.keys(KBO_TEAMS).length)
	})

	test('reads head-to-head records by opponent, skipping itself', () => {
		const [kt, samsung] = standings.teams
		expect(kt.vs['삼성']).toEqual({ wins: 7, losses: 9, ties: 0 })
		expect(samsung.vs['KT']).toEqual({ wins: 9, losses: 7, ties: 0 })
		expect(Object.keys(kt.vs)).toHaveLength(9)
		expect(kt.vs['KT']).toBeUndefined()
		expect(kt.vs['합계']).toBeUndefined()
	})

	test('throws when the page has no standings table', () => {
		expect(() => parseKboStandings('<html></html>')).toThrow()
	})
})
