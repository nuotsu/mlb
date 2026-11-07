/// <reference types="bun" />

import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'
import { parseNpbRecord, parseNpbStandings, type NpbLeagueId } from './npb'

const fixture = (name: string) =>
	readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8')

const parse = (name: string, season: number, league: NpbLeagueId) =>
	parseNpbStandings(fixture(name), { season, league })

describe('parseNpbRecord', () => {
	test('reads wins, losses and parenthesized ties', () => {
		expect(parseNpbRecord('37-33\n(2)')).toEqual({ wins: 37, losses: 33, ties: 2 })
		expect(parseNpbRecord('42-29')).toEqual({ wins: 42, losses: 29, ties: 0 })
	})

	test('returns null for the self column and blanks', () => {
		expect(parseNpbRecord('***')).toBeNull()
		expect(parseNpbRecord('')).toBeNull()
	})
})

describe('parseNpbStandings (2025+ layout)', () => {
	const standings = parse('npb-std_c-2026', 2026, 'central')

	test('reads the league and status', () => {
		expect(standings.id).toBe('central')
		expect(standings.name).toBe('Central League')
		expect(standings.status).toBe('全日程終了')
		expect(standings.teams).toHaveLength(6)
	})

	test('reads the leader row', () => {
		expect(standings.teams[0]).toMatchObject({
			rank: 1,
			nameJa: '阪神タイガース',
			name: 'Hanshin Tigers',
			abbreviation: 'T',
			games: 143,
			wins: 79,
			losses: 62,
			ties: 2,
			pct: '.560',
			gamesBack: null,
			home: { wins: 37, losses: 33, ties: 2 },
			road: { wins: 42, losses: 29, ties: 0 },
			interleague: { wins: 6, losses: 12, ties: 0 },
		})
	})

	test('maps head-to-head columns to full opponent names', () => {
		const [tigers, giants] = standings.teams
		expect(giants.gamesBack).toBe(2.5)
		expect(tigers.vs['読売ジャイアンツ']).toEqual({ wins: 16, losses: 8, ties: 1 })
		expect(giants.vs['阪神タイガース']).toEqual({ wins: 8, losses: 16, ties: 1 })
		expect(Object.keys(tigers.vs)).toHaveLength(5)
		expect(tigers.vs['阪神タイガース']).toBeUndefined()
	})

	test('only reads the league table, not the interleague table', () => {
		expect(standings.teams.every((t) => t.games === 143)).toBe(true)
	})
})

describe('parseNpbStandings (2005 to 2024 layout)', () => {
	test('joins names split across lines and padded with full-width spaces', () => {
		const standings = parse('npb-std_c-2024', 2024, 'central')
		expect(standings.status).toBe('全日程終了')
		expect(standings.teams.map((t) => t.nameJa)).toEqual([
			'読売ジャイアンツ',
			'阪神タイガース',
			'横浜DeNAベイスターズ',
			'広島東洋カープ',
			'東京ヤクルトスワローズ',
			'中日ドラゴンズ',
		])
		expect(standings.teams[0]).toMatchObject({
			wins: 77,
			losses: 59,
			ties: 7,
			home: { wins: 39, losses: 30, ties: 3 },
			interleague: { wins: 8, losses: 9, ties: 1 },
		})
		expect(standings.teams[1].vs['読売ジャイアンツ']).toEqual({ wins: 12, losses: 12, ties: 1 })
	})

	test('has no interleague record in 2020', () => {
		const standings = parse('npb-std_c-2020', 2020, 'central')
		expect(standings.teams).toHaveLength(6)
		expect(standings.teams[0].games).toBe(120)
		expect(standings.teams.every((t) => t.interleague === null)).toBe(true)
	})

	test('resolves older team names and blank games back', () => {
		const standings = parse('npb-std_p-2005', 2005, 'pacific')
		const names = standings.teams.map((t) => t.name)
		expect(names).toContain('Seibu Lions')
		expect(names).toContain('Orix Buffaloes')
		// The 2005 Pacific League was ranked by its playoff, so NPB leaves games back blank.
		expect(standings.teams.every((t) => t.gamesBack === null)).toBe(true)
		expect(standings.teams[0].nameJa).toBe('千葉ロッテマリーンズ')
	})
})

test('throws when the page has no standings table', () => {
	expect(() => parseNpbStandings('<html></html>', { season: 2026, league: 'central' })).toThrow()
})
