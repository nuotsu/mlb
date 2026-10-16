/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import { batsThrows, groupRoster } from './roster'

const entry = (id: number, lastFirstName: string, type: string) =>
	({
		person: { id, fullName: lastFirstName, lastFirstName },
		position: { type, abbreviation: type[0] },
	}) as unknown as MLB.Roster

describe('groupRoster', () => {
	test('groups by position type in display order, sorted by name', () => {
		const groups = groupRoster([
			entry(1, 'Smith, Will', 'Catcher'),
			entry(2, 'Yamamoto, Yoshinobu', 'Pitcher'),
			entry(3, 'Glasnow, Tyler', 'Pitcher'),
			entry(4, 'Ohtani, Shohei', 'Two-Way Player'),
			entry(5, 'Betts, Mookie', 'Infielder'),
			entry(6, 'Teoscar, Hernández', 'Outfielder'),
		])

		expect(groups.map(({ label, players }) => [label, players.map((p) => p.person.id)])).toEqual([
			['Pitchers', [3, 2]],
			['Catchers', [1]],
			['Infielders', [5]],
			['Outfielders', [6]],
			['Two-Way', [4]],
		])
	})

	test('keeps a player listed twice once, and unknown positions under Other', () => {
		const groups = groupRoster([
			entry(1, 'Smith, Will', 'Catcher'),
			entry(1, 'Smith, Will', 'Catcher'),
			entry(2, 'Doe, John', 'Mystery'),
		])

		expect(groups.map(({ label, players }) => [label, players.length])).toEqual([
			['Catchers', 1],
			['Other', 1],
		])
	})

	test('is empty for an empty roster', () => {
		expect(groupRoster([])).toEqual([])
	})
})

describe('batsThrows', () => {
	test('reads bats and throws', () => {
		expect(batsThrows({ batSide: { code: 'L' }, pitchHand: { code: 'R' } } as MLB.Person)).toBe(
			'L/R',
		)
		expect(batsThrows({})).toBe('—/—')
	})
})
