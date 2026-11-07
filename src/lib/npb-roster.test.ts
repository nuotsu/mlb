/// <reference types="bun" />

import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'
import {
	buildNpbRoster,
	isNpbTeam,
	npbFieldingUrl,
	npbPhotoUrl,
	npbRosterUrl,
	parseNpbDate,
	parseNpbFielding,
	parseNpbRoster,
} from './npb-roster'

const fixture = (name: string) =>
	readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8')

const en = parseNpbRoster(fixture('npb-rst_g-2026'))
const ja = parseNpbRoster(fixture('npb-rst_g-ja-2026'))
const fielding = [
	parseNpbFielding(fixture('npb-idf1_g-2026')),
	parseNpbFielding(fixture('npb-idf2_g-2026')),
]

describe('parseNpbDate', () => {
	test('reads English and dotted dates', () => {
		expect(parseNpbDate('Mar. 20, 1979')).toBe('1979-03-20')
		expect(parseNpbDate('May 21, 2001')).toBe('2001-05-21')
		expect(parseNpbDate('1979.03.20')).toBe('1979-03-20')
	})

	test('returns null for anything else', () => {
		expect(parseNpbDate('')).toBeNull()
		expect(parseNpbDate('3/20/1979')).toBeNull()
	})
})

describe('URLs', () => {
	test('map Stats API team IDs to npb.jp page codes', () => {
		expect(npbRosterUrl(241)).toBe('https://npb.jp/bis/eng/teams/rst_g.html')
		expect(npbRosterUrl('2800', 'ja')).toBe('https://npb.jp/bis/teams/rst_db.html')
		expect(npbFieldingUrl(2026, 2800, 2)).toBe('https://npb.jp/bis/2026/stats/idf2_db.html')
		expect(isNpbTeam('241')).toBe(true)
		expect(isNpbTeam(119)).toBe(false)
		expect(() => npbRosterUrl(119)).toThrow()
	})

	test('pad the uniform number to three digits for photos', () => {
		expect(npbPhotoUrl(2026, 2800, '43', '61665155')).toBe(
			'https://p.npb.jp/players_photo/2026/180/db/043_61665155.jpg',
		)
		expect(npbPhotoUrl(2026, 241, '00', '43145136')).toBe(
			'https://p.npb.jp/players_photo/2026/180/g/000_43145136.jpg',
		)
		expect(npbPhotoUrl(2026, 241, '011', '61265152')).toBe(
			'https://p.npb.jp/players_photo/2026/180/g/011_61265152.jpg',
		)
	})
})

describe('parseNpbRoster', () => {
	test('reads the team, season and status', () => {
		expect(en.team).toBe('Yomiuri Giants')
		expect(en.season).toBe(2026)
		expect(en.status).toBe('2026 Season Final')
		expect(ja.season).toBe(2026)
	})

	test('reads the manager in either language', () => {
		expect(en.manager).toEqual({
			number: '83',
			name: 'Abe, Shinnosuke',
			nameJa: null,
			birthDate: '1979-03-20',
		})
		expect(ja.manager?.name).toBe('阿部 慎之助')
	})

	test('reads registered players with their position group', () => {
		expect(en.players.find(({ name }) => name === 'Hotta, Kenshin')).toMatchObject({
			id: '21625151',
			number: '91',
			href: 'https://npb.jp/bis/eng/players/21625151.html',
			group: 'P',
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

		const groups = new Set(en.players.map(({ group }) => group))
		expect([...groups].sort()).toEqual(['C', 'IF', 'OF', 'P'])
	})

	test('reads the same players from the Japanese page', () => {
		// Same IDs, though the English page sorts each group by name
		const ids = (roster: typeof en) => roster.players.map(({ id }) => id).sort()
		expect(ids(ja)).toEqual(ids(en))
		expect(ja.players.find(({ id }) => id === '21625151')?.name).toBe('堀田 賢慎')
	})

	test('flags departed players and keeps their note', () => {
		expect(en.players.find(({ name }) => name.startsWith('Wakabayashi'))).toMatchObject({
			departed: true,
			note: 'Traded to Seibu (Jul. 30).',
		})
	})

	test('marks the developmental squad and decodes notes', () => {
		const developmental = en.players.filter((p) => p.developmental)
		expect(developmental.length).toBeGreaterThan(0)
		expect(developmental.every(({ number }) => number.startsWith('0'))).toBe(true)
		expect(en.players.some(({ note }) => note?.includes('(developmental player ->)'))).toBe(true)
	})

	test('throws when the page has no roster', () => {
		expect(() => parseNpbRoster('<html></html>')).toThrow()
	})
})

describe('parseNpbFielding', () => {
	test('reads games by position, keyed by Japanese name', () => {
		// Sakamoto: mostly third base by 2026
		const sakamoto = fielding[0].get('坂本勇人')
		expect(sakamoto?.['3B']).toBeGreaterThan(0)
		expect(fielding[0].get('甲斐拓也')?.C).toBeGreaterThan(0)
	})
})

describe('buildNpbRoster', () => {
	const roster = buildNpbRoster({ teamId: 241, en, ja, fielding })
	const byName = (name: string) => roster.players.find((p) => p.name === name)!

	test('adds Japanese names with a half-width space', () => {
		expect(roster.manager?.nameJa).toBe('阿部 慎之助')
		expect(byName('Hotta, Kenshin').nameJa).toBe('堀田 賢慎')
	})

	test('adds photo URLs', () => {
		expect(byName('Hotta, Kenshin').photo).toBe(
			'https://p.npb.jp/players_photo/2026/180/g/091_21625151.jpg',
		)
	})

	test('narrows infielders to the position played most', () => {
		const infielders = roster.players.filter(({ group }) => group === 'IF')
		expect(infielders.some(({ position }) => ['1B', '2B', '3B', 'SS'].includes(position))).toBe(
			true,
		)
		expect(byName('Kai, Takuya').position).toBe('C')
		expect(byName('Hotta, Kenshin').position).toBe('P')
	})

	test('keeps the roster group without the extra pages', () => {
		const plain = buildNpbRoster({ teamId: 241, en })
		expect(plain.players.every(({ position, group }) => position === group)).toBe(true)
		expect(plain.players.every(({ nameJa }) => nameJa === null)).toBe(true)
		expect(plain.manager?.nameJa).toBeNull()
	})
})
