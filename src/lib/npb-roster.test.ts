/// <reference types="bun" />

import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'
import { isNpbTeam, npbRosterUrl, parseNpbDate, parseNpbRoster } from './npb-roster'

const html = readFileSync(new URL('./fixtures/npb-rst_g-2026.html', import.meta.url), 'utf8')

describe('parseNpbDate', () => {
	test('reads abbreviated and short month names', () => {
		expect(parseNpbDate('Mar. 20, 1979')).toBe('1979-03-20')
		expect(parseNpbDate('May 21, 2001')).toBe('2001-05-21')
	})

	test('returns null for anything else', () => {
		expect(parseNpbDate('')).toBeNull()
		expect(parseNpbDate('1979.03.20')).toBeNull()
	})
})

describe('npbRosterUrl', () => {
	test('maps Stats API team IDs to npb.jp page codes', () => {
		expect(npbRosterUrl(241)).toBe('https://npb.jp/bis/eng/teams/rst_g.html')
		expect(npbRosterUrl('2800')).toBe('https://npb.jp/bis/eng/teams/rst_db.html')
		expect(isNpbTeam('241')).toBe(true)
		expect(isNpbTeam(119)).toBe(false)
		expect(() => npbRosterUrl(119)).toThrow()
	})
})

describe('parseNpbRoster', () => {
	const roster = parseNpbRoster(html)

	test('reads the team, season and status', () => {
		expect(roster.team).toBe('Yomiuri Giants')
		expect(roster.season).toBe(2026)
		expect(roster.status).toBe('2026 Season Final')
	})

	test('reads the manager', () => {
		expect(roster.manager).toEqual({
			number: '83',
			name: 'Abe, Shinnosuke',
			birthDate: '1979-03-20',
		})
	})

	test('reads registered players with their position', () => {
		expect(roster.players.find(({ name }) => name === 'Hotta, Kenshin')).toEqual({
			id: '21625151',
			number: '91',
			name: 'Hotta, Kenshin',
			href: 'https://npb.jp/bis/eng/players/21625151.html',
			position: 'P',
			birthDate: '2001-05-21',
			height: 186,
			weight: 90,
			throws: 'R',
			bats: 'R',
			developmental: false,
			departed: false,
			note: null,
		})

		const positions = new Set(roster.players.map(({ position }) => position))
		expect([...positions].sort()).toEqual(['C', 'IF', 'OF', 'P'])
	})

	test('flags departed players and keeps their note', () => {
		expect(roster.players.find(({ name }) => name.startsWith('Wakabayashi'))).toMatchObject({
			departed: true,
			note: 'Traded to Seibu (Jul. 30).',
		})
	})

	test('marks the developmental squad and decodes notes', () => {
		const developmental = roster.players.filter((p) => p.developmental)
		expect(developmental.length).toBeGreaterThan(0)
		expect(developmental.every(({ number }) => number.startsWith('0'))).toBe(true)
		expect(roster.players.some(({ note }) => note?.includes('(developmental player ->)'))).toBe(
			true,
		)
	})

	test('throws when the page has no roster', () => {
		expect(() => parseNpbRoster('<html></html>')).toThrow()
	})
})
