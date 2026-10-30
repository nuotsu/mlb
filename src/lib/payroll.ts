import data from './data/payroll.json'

/**
 * Team payrolls scraped from Spotrac (or FanGraphs) by `scripts/fetch-payroll.ts`, since the
 * Stats API has none. One season at a time, refreshed weekly by a GitHub Action.
 */
export type PayrollData = {
	season: number
	/** `YYYY-MM-DD` the numbers last changed; `null` until the first scrape */
	lastUpdated: string | null
	source: { name: string; url: string }
	/** The season's Competitive Balance Tax base threshold, in dollars */
	luxuryTaxThreshold: number | null
	/** Highest payroll first */
	teams: TeamPayroll[]
}

export type TeamPayroll = {
	/** Stats API team ID */
	teamId: number
	name: string
	abbreviation: string
	/** Total payroll, in dollars */
	payroll: number
	/** Payroll as the CBT counts it (average annual values plus benefits), in dollars */
	luxuryTaxPayroll: number | null
	sourceUrl: string
}

export const payroll = data as PayrollData

/** `$312.5M` */
export function formatPayroll(dollars: number, digits = 1) {
	return `$${(dollars / 1e6).toFixed(digits)}M`
}

/** A team's payroll and where it ranks in MLB, highest first; ties share a rank. */
export function payrollRank(teamId: number, { teams } = payroll) {
	const team = teams.find((t) => t.teamId === teamId)
	if (!team) return undefined

	return {
		...team,
		rank: teams.filter((t) => t.payroll > team.payroll).length + 1,
		of: teams.length,
	}
}

/** Least-squares fit of `y = slope * x + intercept`; `null` without two distinct `x`s. */
export function linearRegression(points: { x: number; y: number }[]) {
	const n = points.length
	if (n < 2) return null

	const meanX = points.reduce((sum, { x }) => sum + x, 0) / n
	const meanY = points.reduce((sum, { y }) => sum + y, 0) / n

	let covariance = 0
	let variance = 0
	for (const { x, y } of points) {
		covariance += (x - meanX) * (y - meanY)
		variance += (x - meanX) ** 2
	}
	if (!variance) return null

	const slope = covariance / variance
	return { slope, intercept: meanY - slope * meanX }
}

/** Multiples of `step` spanning `[min, max]`, widened out to the nearest step. */
export function ticks(min: number, max: number, step: number) {
	const start = Math.floor(min / step)
	const end = Math.ceil(max / step)
	// Rounded so float steps like .05 don't drift into .15000000000000002
	return Array.from({ length: end - start + 1 }, (_, i) => +((start + i) * step).toFixed(6))
}
