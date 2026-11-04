import { describe, expect, test } from 'bun:test'
import { combineStats, compareRow, parseInnings, positionsPlayed, statsFor } from './compare'

const split = (stat: Record<string, unknown>, team?: string) =>
	({ stat, team: team ? { id: 1, name: team } : undefined }) as unknown as MLB.StatSplit

describe('combineStats', () => {
	test('uses the team-less total for a player traded mid-season', () => {
		const stats = [
			{
				type: { displayName: 'season' },
				splits: [
					split({ homeRuns: 35 }),
					split({ homeRuns: 15 }, 'Boston Red Sox'),
					split({ homeRuns: 20 }, 'San Francisco Giants'),
				],
			},
		] as unknown as MLB.PlayerStats[]
		expect(combineStats(stats, 'hitting').homeRuns).toBe(35)
	})

	test('merges standard and advanced types, standard first', () => {
		const stats = [
			{ splits: [split({ avg: '.300', babip: '.350' })] },
			{ splits: [split({ babip: '.351', iso: '.250' })] },
		] as unknown as MLB.PlayerStats[]
		expect(combineStats(stats, 'hitting')).toEqual({ avg: '.300', babip: '.350', iso: '.250' })
	})

	test('sums fielding positions, skips DH, and recomputes rates', () => {
		const stats = [
			{
				splits: [
					split(
						{
							position: { code: '9', abbreviation: 'RF' },
							gamesPlayed: 90,
							putOuts: 180,
							assists: 6,
							errors: 2,
							innings: '780.1',
						},
						'NYY',
					),
					split(
						{
							position: { code: '8', abbreviation: 'CF' },
							gamesPlayed: 10,
							putOuts: 30,
							assists: 0,
							errors: 1,
							innings: '81.2',
						},
						'NYY',
					),
					split(
						{
							position: { code: '10', abbreviation: 'DH' },
							gamesPlayed: 50,
							putOuts: 0,
							innings: '0.0',
						},
						'NYY',
					),
				],
			},
		] as unknown as MLB.PlayerStats[]
		const total = combineStats(stats, 'fielding')
		expect(total.gamesPlayed).toBe(100)
		expect(total.putOuts).toBe(210)
		expect(total.innings).toBe('862.0')
		expect(total.fielding).toBe('.986')
		expect(total.rangeFactorPer9Inn).toBe('2.26')
		expect(positionsPlayed(stats)).toEqual(['RF', 'CF'])
	})
})

describe('compareRow', () => {
	const def = (key: string) => statsFor('pitching').find((s) => s.key === key)!

	test('higher is better by default', () => {
		expect(compareRow(def('strikeOuts'), [200, 250, 225]).map((c) => c.verdict)).toEqual([
			'worst',
			'best',
			undefined,
		])
	})

	test('lower is better for ERA', () => {
		expect(compareRow(def('era'), ['2.21', '3.50']).map((c) => c.verdict)).toEqual([
			'best',
			'worst',
		])
	})

	test('ties, blanks, and neutral stats are not highlighted', () => {
		expect(compareRow(def('era'), ['3.00', '3.00']).map((c) => c.verdict)).toEqual([
			undefined,
			undefined,
		])
		expect(compareRow(def('era'), ['-.--', '3.00']).map((c) => c.verdict)).toEqual([
			undefined,
			undefined,
		])
		expect(compareRow(def('battersFaced'), [700, 800]).map((c) => c.verdict)).toEqual([
			undefined,
			undefined,
		])
	})

	test('innings compare by thirds', () => {
		expect(parseInnings('195.2')).toBeCloseTo(195.667)
		expect(compareRow(def('inningsPitched'), ['195.2', '196.0']).map((c) => c.verdict)).toEqual([
			'worst',
			'best',
		])
	})
})
