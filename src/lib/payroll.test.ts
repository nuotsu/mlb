import { describe, expect, test } from 'bun:test'
import { formatPayroll, linearRegression, payrollRank, ticks, type PayrollData } from './payroll'

const data = {
	season: 2026,
	lastUpdated: '2026-10-30',
	source: { name: 'Spotrac', url: 'https://www.spotrac.com/mlb/payroll/' },
	luxuryTaxThreshold: 244_000_000,
	teams: [
		{ teamId: 1, payroll: 300e6 },
		{ teamId: 2, payroll: 200e6 },
		{ teamId: 3, payroll: 200e6 },
		{ teamId: 4, payroll: 100e6 },
	].map((t) => ({ ...t, name: '', abbreviation: '', luxuryTaxPayroll: null, sourceUrl: '' })),
} satisfies PayrollData

describe('payrollRank', () => {
	test('ranks highest payroll first', () => {
		expect(payrollRank(1, data)).toMatchObject({ rank: 1, of: 4 })
		expect(payrollRank(4, data)).toMatchObject({ rank: 4, of: 4 })
	})

	test('ties share a rank', () => {
		expect(payrollRank(2, data)?.rank).toBe(2)
		expect(payrollRank(3, data)?.rank).toBe(2)
	})

	test('unknown team', () => {
		expect(payrollRank(99, data)).toBeUndefined()
	})
})

describe('linearRegression', () => {
	test('fits a line', () => {
		const fit = linearRegression([
			{ x: 0, y: 1 },
			{ x: 1, y: 3 },
			{ x: 2, y: 5 },
		])
		expect(fit?.slope).toBeCloseTo(2)
		expect(fit?.intercept).toBeCloseTo(1)
	})

	test('needs two distinct x values', () => {
		expect(linearRegression([{ x: 1, y: 1 }])).toBeNull()
		expect(
			linearRegression([
				{ x: 1, y: 1 },
				{ x: 1, y: 2 },
			]),
		).toBeNull()
	})
})

test('ticks widen to the nearest step', () => {
	expect(ticks(62, 318, 50)).toEqual([50, 100, 150, 200, 250, 300, 350])
	expect(ticks(0.38, 0.62, 0.05)).toEqual([0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65])
})

test('formatPayroll', () => {
	expect(formatPayroll(312_456_789)).toBe('$312.5M')
	expect(formatPayroll(244_000_000, 0)).toBe('$244M')
})
