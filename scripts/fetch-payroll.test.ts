import { describe, expect, test } from 'bun:test'
import {
	findColumn,
	matchTeam,
	parseDollars,
	parseTables,
	readFanGraphs,
	readSpotracTable,
	toPayrollData,
	validate,
} from './fetch-payroll'

const TEAMS = [
	{ id: 147, name: 'New York Yankees', teamName: 'Yankees', abbreviation: 'NYY' },
	{ id: 111, name: 'Boston Red Sox', teamName: 'Red Sox', abbreviation: 'BOS' },
	{ id: 145, name: 'Chicago White Sox', teamName: 'White Sox', abbreviation: 'CWS' },
	{ id: 133, name: 'Athletics', teamName: 'Athletics', abbreviation: 'ATH' },
	{ id: 109, name: 'Arizona Diamondbacks', teamName: 'D-backs', abbreviation: 'AZ' },
	{ id: 141, name: 'Toronto Blue Jays', teamName: 'Blue Jays', abbreviation: 'TOR' },
]

describe('matchTeam', () => {
	test.each([
		['NYY', 147],
		['new york yankees', 147],
		['Boston Red Sox', 111],
		['chicago white sox', 145],
		['CHW', 145],
		['oakland athletics', 133],
		['athletics', 133],
		['OAK', 133],
		['ARI', 109],
		['toronto blue jays', 141],
		['Blue Jays', 141],
	])('%s', (label, id) => {
		expect(matchTeam(label, TEAMS)?.id).toBe(id)
	})

	test('no match', () => {
		expect(matchTeam('Montreal Expos', TEAMS)).toBeUndefined()
		expect(matchTeam('', TEAMS)).toBeUndefined()
	})
})

test('parseDollars', () => {
	const cell = (text: string, attrs = {}) => ({ text, html: text, attrs })
	expect(parseDollars(cell('$312,456,789'))).toBe(312_456_789)
	expect(parseDollars(cell('$312.5M'))).toBe(312_500_000)
	expect(parseDollars(cell('-', { 'data-sort': '98765432' }))).toBe(98_765_432)
	expect(parseDollars(cell('-'))).toBeNull()
})

test('findColumn prefers earlier patterns, then later columns', () => {
	const headers = ['Rank', 'Team', 'Active Payroll', 'Total Payroll', 'Tax Payroll']
	expect(findColumn(headers, [/total.*payroll/i, /payroll/i], /tax/i)).toBe(3)
	expect(findColumn(headers, /payroll/i, /tax|total/i)).toBe(2)
	expect(findColumn(headers, /bill/i)).toBe(-1)
})

const SPOTRAC = `
<table id="table">
	<thead><tr><th>Rank</th><th>Team</th><th>Win %</th><th>Active Payroll</th><th>2026 Total Payroll</th></tr></thead>
	<tbody>
		<tr><td>1</td><td><a href="https://www.spotrac.com/mlb/new-york-yankees/payroll/_/year/2026/"><img alt="">NYY</a></td><td>.580</td><td>$250,000,000</td><td data-sort="301234567">$301,234,567</td></tr>
		<tr><td>2</td><td><a href="/mlb/boston-red-sox/payroll/_/year/2026/">BOS</a></td><td>.540</td><td>$190,000,000</td><td>$205,000,000</td></tr>
		<tr><td>3</td><td><a href="/mlb/chicago-white-sox/payroll/_/year/2026/">CHW</a></td><td>.380</td><td>$70,000,000</td><td>$80,500,000</td></tr>
	</tbody>
</table>`

test('parseTables', () => {
	const [table] = parseTables(SPOTRAC)
	expect(table.headers).toEqual(['Rank', 'Team', 'Win %', 'Active Payroll', '2026 Total Payroll'])
	expect(table.rows).toHaveLength(3)
	expect(table.rows[0][4].attrs['data-sort']).toBe('301234567')
})

test('readSpotracTable', () => {
	const result = readSpotracTable(SPOTRAC, TEAMS, {
		include: [/total.*payroll/i, /payroll/i],
		exclude: /tax|cbt|rank|%/i,
	})
	expect(result?.values.get(147)).toEqual({
		value: 301_234_567,
		href: 'https://www.spotrac.com/mlb/new-york-yankees/payroll/_/year/2026/',
	})
	expect(result?.values.get(145)?.value).toBe(80_500_000)
	expect(result?.values.get(145)?.href).toBe(
		'https://www.spotrac.com/mlb/chicago-white-sox/payroll/_/year/2026/',
	)
})

test('readFanGraphs finds the team table in __NEXT_DATA__', () => {
	const rows = TEAMS.map(({ abbreviation }, i) => ({
		Team: abbreviation,
		TotalPayroll: 300 - i * 20,
		CBTPayroll: 310 - i * 20,
	}))
	const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
		props: { pageProps: { dehydratedState: { queries: [{ state: { data: rows } }] } } },
	})}</script>`

	const result = readFanGraphs(html, 2026, TEAMS)
	expect(result.source.name).toBe('FanGraphs RosterResource')
	expect(result.teams[0]).toMatchObject({
		teamId: 147,
		payroll: 300_000_000,
		luxuryTaxPayroll: 310_000_000,
	})
})

describe('output', () => {
	const scraped = {
		source: { name: 'Spotrac', url: 'https://www.spotrac.com/mlb/payroll/' },
		luxuryTaxThreshold: null,
		teams: TEAMS.map(({ id }, i) => ({
			teamId: id,
			payroll: 100e6 + i * 10e6,
			luxuryTaxPayroll: null,
			sourceUrl: '',
		})),
	}

	test('validate rejects missing teams and misread columns', () => {
		expect(() => validate(scraped, TEAMS)).not.toThrow()
		expect(() => validate({ ...scraped, teams: scraped.teams.slice(1) }, TEAMS)).toThrow(/Yankees/)
		expect(() =>
			validate(
				{ ...scraped, teams: [{ ...scraped.teams[0], payroll: 0.58 }, ...scraped.teams.slice(1)] },
				TEAMS,
			),
		).toThrow(/implausible/)
	})

	test('sorts by payroll, fills the CBA threshold, and keeps the date when nothing changed', () => {
		const first = toPayrollData(scraped, 2026, TEAMS, null, new Date('2026-10-01T12:00:00Z'))
		expect(first.teams[0].teamId).toBe(141)
		expect(first.luxuryTaxThreshold).toBe(244_000_000)
		expect(first.lastUpdated).toBe('2026-10-01')

		const same = toPayrollData(scraped, 2026, TEAMS, first, new Date('2026-10-08T12:00:00Z'))
		expect(same.lastUpdated).toBe('2026-10-01')

		const changed = toPayrollData(
			{ ...scraped, teams: scraped.teams.map((t) => ({ ...t, payroll: t.payroll + 1e6 })) },
			2026,
			TEAMS,
			first,
			new Date('2026-10-08T12:00:00Z'),
		)
		expect(changed.lastUpdated).toBe('2026-10-08')
	})
})
