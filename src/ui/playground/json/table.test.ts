import { describe, expect, test } from 'bun:test'
import {
	buildRows,
	flatten,
	isCollapsed,
	keyOf,
	leafJson,
	markMatches,
	pathOf,
	revealNode,
	search,
	T_ARRAY,
	T_NUMBER,
	T_OBJECT,
	T_STRING,
	valueOf,
	type Folding,
} from './table'

const doc = {
	copyright: 'MLB',
	dates: [
		{
			date: '2026-10-12',
			games: [
				{ gamePk: 849812, link: '/api/v1.1/game/849812/feed/live', tie: false, note: null },
				{ gamePk: 849813, 'odd key': 'x' },
			],
		},
	],
	empty: {},
	none: [],
}

const open = (): Folding => ({ depthLimit: Infinity, toggled: new Set() })

describe('flatten', () => {
	const t = flatten(doc)

	test('stores every node in document order', () => {
		expect(t.n).toBe(16)
		expect(t.type[0]).toBe(T_OBJECT)
		expect(keyOf(t, 1)).toBe('copyright')
		expect(valueOf(t, 1)).toBe('MLB')
		expect(t.type[2]).toBe(T_ARRAY)
		expect(t.size[2]).toBe(1)
		expect(t.end[0]).toBe(t.n)
	})

	test('line numbers match JSON.stringify(doc, null, 2)', () => {
		const pretty = JSON.stringify(doc, null, 2).split('\n')
		expect(t.lines).toBe(pretty.length)

		const gamePk = [...Array(t.n).keys()].find((i) => keyOf(t, i) === 'gamePk')!
		expect(pretty[t.line[gamePk] - 1].trim()).toBe('"gamePk": 849812,')
		expect(pretty[t.closeLine[0] - 1]).toBe('}')
		expect(t.closeLine[t.n - 1]).toBe(0) // `none: []` has no closing line
	})

	test('a fully expanded row list has one row per pretty-printed line', () => {
		expect(buildRows(t, open()).length).toBe(t.lines)
		expect(t.maxRows).toBe(t.lines)
	})

	test('leaf JSON round-trips', () => {
		const gamePk = [...Array(t.n).keys()].find((i) => t.type[i] === T_NUMBER)!
		expect(leafJson(t, gamePk)).toBe('849812')
		expect(leafJson(t, 1)).toBe('"MLB"')
		expect(t.type[1]).toBe(T_STRING)
	})
})

describe('pathOf', () => {
	const t = flatten(doc)
	const find = (key: string) => [...Array(t.n).keys()].filter((i) => keyOf(t, i) === key)

	test('builds accessor paths', () => {
		expect(pathOf(t, 0)).toBe('')
		expect(pathOf(t, find('gamePk')[1])).toBe('dates[0].games[1].gamePk')
		expect(pathOf(t, find('odd key')[0])).toBe('dates[0].games[1]["odd key"]')
	})
})

describe('folding', () => {
	const t = flatten(doc)

	test('depth limit collapses deeper containers, toggles flip them', () => {
		const folding: Folding = { depthLimit: 1, toggled: new Set() }
		const rows = buildRows(t, folding)
		// root open, its 4 children (dates collapsed, empty containers never collapse), root close
		expect([...rows]).toEqual([0, 1, 2, t.end[2], t.end[2] + 1, ~0])

		folding.toggled.add(2)
		expect(isCollapsed(t, 2, folding)).toBe(false)
		expect(buildRows(t, folding).length).toBeGreaterThan(rows.length)
	})

	test('revealNode opens every ancestor', () => {
		const folding: Folding = { depthLimit: 1, toggled: new Set() }
		const deep = [...Array(t.n).keys()].find((i) => keyOf(t, i) === 'odd key')!
		expect(revealNode(t, deep, folding)).toBe(true)
		expect(buildRows(t, folding)).toContain(deep)
	})
})

describe('search', () => {
	const t = flatten(doc)

	test('matches keys and values case-insensitively', () => {
		const matches = search(t, 'GAMEPK')
		expect([...matches].map((i) => keyOf(t, i))).toEqual(['gamePk', 'gamePk'])
		expect(search(t, '849812').length).toBe(2) // number + link string
		expect(search(t, '').length).toBe(0)
	})

	test('a match never spans two nodes', () => {
		// "copyright" + "MLB" are adjacent in the concatenated text; "tMLB" must not match
		expect(search(t, 'htMLB').length).toBe(0)
		expect(search(t, 'rightdates').length).toBe(0)
	})

	test('filtered rows keep matches and their ancestors only', () => {
		const matches = search(t, 'odd')
		const rows = buildRows(t, open(), markMatches(t, matches))
		const opened = [...rows].filter((r) => r >= 0).map((i) => pathOf(t, i))
		expect(opened).toEqual([
			'',
			'dates',
			'dates[0]',
			'dates[0].games',
			'dates[0].games[1]',
			'dates[0].games[1]["odd key"]',
		])
	})
})
