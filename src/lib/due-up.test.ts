/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import { dueUp } from './due-up'

const person = (id: number) => ({ id }) as MLB.Person
const ids = (people: (MLB.Person | undefined)[]) => people.map((p) => p?.id)

// Bottom 2nd at Messick's 30th pitch: Doyle is at the plate
const offense = { batter: person(5), onDeck: person(6), inHole: person(7) } as MLB.Offense
const battingOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9]

describe('dueUp', () => {
	test('skips the batter at the plate, filling in the third from the batting order', () => {
		expect(ids(dueUp(offense, { atBat: 5, battingOrder }))).toEqual([6, 7, 8])
	})

	test('wraps around the top of the order', () => {
		const late = { batter: person(7), onDeck: person(8), inHole: person(9) } as MLB.Offense
		expect(ids(dueUp(late, { atBat: 7, battingOrder }))).toEqual([8, 9, 1])
	})

	test('between batters or innings, the listed batter really is next up', () => {
		expect(ids(dueUp(offense))).toEqual([5, 6, 7])
		expect(ids(dueUp(offense, { atBat: 4, battingOrder }))).toEqual([5, 6, 7])
	})

	test('leaves the third empty when the batting order is missing', () => {
		expect(ids(dueUp(offense, { atBat: 5 }))).toEqual([6, 7, undefined])
		expect(ids(dueUp(offense, { atBat: 5, battingOrder: [1, 2] }))).toEqual([6, 7, undefined])
	})
})
