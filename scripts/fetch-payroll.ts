/**
 * Scrapes every MLB team's payroll for a season and writes it to `src/lib/data/payroll.json`,
 * which the standings page's Payroll view and the team page read. The Stats API has no payroll
 * data, so this pulls Spotrac's payroll and luxury tax tables, falling back to FanGraphs
 * RosterResource if Spotrac can't be read.
 *
 *   bun scripts/fetch-payroll.ts [--season 2026] [--dry-run]
 *
 * Both sites turn away requests that don't come from a real browser, so the page can instead be
 * saved from one (File → Save Page As, "Webpage, HTML only") and read from disk:
 *
 *   bun scripts/fetch-payroll.ts --html spotrac-payroll.html [--tax-html spotrac-tax.html]
 *
 * `--html` takes Spotrac's payroll page (https://www.spotrac.com/mlb/payroll/) or FanGraphs'
 * (https://www.fangraphs.com/roster-resource/payroll); `--tax-html` adds the luxury tax payrolls
 * from Spotrac's https://www.spotrac.com/mlb/tax/.
 *
 * Exits non-zero, leaving the file alone, unless all 30 teams come back with a plausible payroll.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import type { PayrollData, TeamPayroll } from '../src/lib/payroll.ts'

const OUTPUT = new URL('../src/lib/data/payroll.json', import.meta.url)

/**
 * Competitive Balance Tax base thresholds from the 2022–26 CBA. Used when the source page
 * doesn't state one; a season past the CBA needs its threshold added here.
 */
export const CBT_THRESHOLDS: Record<number, number> = {
	2022: 230_000_000,
	2023: 233_000_000,
	2024: 237_000_000,
	2025: 241_000_000,
	2026: 244_000_000,
}

/** No MLB payroll has come close to either end; anything outside means a misread column. */
const MIN_PLAUSIBLE = 20_000_000
const MAX_PLAUSIBLE = 700_000_000

const HEADERS = {
	'user-agent':
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
	accept: 'text/html,application/xhtml+xml',
	'accept-language': 'en-US,en;q=0.9',
}

type StatsTeam = { id: number; name: string; teamName: string; abbreviation: string }

type ScrapedTeam = {
	teamId: number
	payroll: number
	luxuryTaxPayroll: number | null
	sourceUrl: string
}

type Scraped = {
	source: PayrollData['source']
	luxuryTaxThreshold: number | null
	teams: ScrapedTeam[]
}

// --- HTML tables ---

export type Cell = { text: string; html: string; attrs: Record<string, string> }
export type Table = { headers: string[]; rows: Cell[][] }

const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
}

export function decodeEntities(text: string) {
	return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
		if (code[0] !== '#') return ENTITIES[code.toLowerCase()] ?? match
		const n =
			code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : Number(code.slice(1))
		return Number.isFinite(n) ? String.fromCodePoint(n) : match
	})
}

export function textContent(html: string) {
	return decodeEntities(
		html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' '),
	)
		.replace(/\s+/g, ' ')
		.trim()
}

function parseAttrs(source: string) {
	const attrs: Record<string, string> = {}
	for (const [, name, , double, single, bare] of source.matchAll(
		/([\w:-]+)(\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g,
	)) {
		attrs[name.toLowerCase()] = decodeEntities(double ?? single ?? bare ?? '')
	}
	return attrs
}

/** Every `<table>` in the page, with its header labels and body cells. Enough for the flat data tables these sites render server-side. */
export function parseTables(html: string): Table[] {
	return [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map(([table]) => {
		const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(([, row]) =>
			[...row.matchAll(/<(t[hd])\b([^>]*)>([\s\S]*?)<\/\1>/gi)].map(([, tag, attrs, html]) => ({
				tag: tag.toLowerCase(),
				cell: { text: textContent(html), html, attrs: parseAttrs(attrs) },
			})),
		)

		const headerIndex = rows.findIndex(
			(cells) => cells.length && cells.every(({ tag }) => tag === 'th'),
		)
		return {
			headers: headerIndex >= 0 ? rows[headerIndex].map(({ cell }) => cell.text) : [],
			rows: rows
				.slice(headerIndex + 1)
				.filter((cells) => cells.some(({ tag }) => tag === 'td'))
				.map((cells) => cells.map(({ cell }) => cell)),
		}
	})
}

/** `$312,456,789`, `312.5M`, or a `data-sort` attribute holding the raw number. */
export function parseDollars(cell: Cell | undefined) {
	if (!cell) return null

	const sort = Number(cell.attrs['data-sort'] ?? cell.attrs['data-order'])
	if (Number.isFinite(sort) && sort > 0) return sort

	const match = cell.text.replace(/,/g, '').match(/\$?\s*(-?\d+(?:\.\d+)?)\s*([MK])?/i)
	if (!match) return null

	const n = Number(match[1])
	const unit = match[2]?.toUpperCase()
	return unit === 'M' ? n * 1e6 : unit === 'K' ? n * 1e3 : n
}

/**
 * Index of the column whose header matches the earliest of `include` and none of `exclude`.
 * Within one pattern, later columns win: totals sit at the end of these tables.
 */
export function findColumn(headers: string[], include: RegExp | RegExp[], exclude?: RegExp) {
	for (const pattern of [include].flat()) {
		for (let i = headers.length - 1; i >= 0; i--) {
			if (pattern.test(headers[i]) && !exclude?.test(headers[i])) return i
		}
	}
	return -1
}

// --- Teams ---

const normalize = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()

/** Abbreviations the sources use that differ from the Stats API's. */
const ABBREVIATION_ALIASES: Record<string, number> = {
	ARI: 109,
	AZ: 109,
	OAK: 133,
	ATH: 133,
	CHW: 145,
	CWS: 145,
	KCR: 118,
	SDP: 135,
	SFG: 137,
	TBR: 139,
	TBA: 139,
	WAS: 120,
	WSN: 120,
	WSH: 120,
	ANA: 108,
	LAA: 108,
}

/**
 * The Stats API team a scraped label refers to: a URL slug like `new-york-yankees`, a full name,
 * a nickname, or an abbreviation. Nicknames are unique across the league ("Red Sox" vs.
 * "White Sox"), so a label ending in one is a match.
 */
export function matchTeam(label: string, teams: StatsTeam[]) {
	const trimmed = label.trim()
	const upper = trimmed.toUpperCase()

	const byAbbreviation =
		teams.find(({ abbreviation }) => abbreviation === upper) ??
		teams.find(({ id }) => ABBREVIATION_ALIASES[upper] === id)
	if (byAbbreviation) return byAbbreviation

	const text = normalize(trimmed)
	if (!text) return undefined

	return (
		teams.find(({ name }) => normalize(name) === text) ??
		teams.find(
			({ teamName }) => text === normalize(teamName) || text.endsWith(` ${normalize(teamName)}`),
		) ??
		teams.find(({ teamName }) => ` ${text} `.includes(` ${normalize(teamName)} `))
	)
}

async function fetchTeams(season: number): Promise<StatsTeam[]> {
	const url = new URL('https://statsapi.mlb.com/api/v1/teams')
	url.searchParams.set('sportId', '1')
	url.searchParams.set('season', String(season))
	url.searchParams.set('fields', 'teams,id,name,teamName,abbreviation')

	const response = await fetch(url)
	if (!response.ok) throw new Error(`Stats API ${response.status}: ${url}`)
	return ((await response.json()) as { teams: StatsTeam[] }).teams
}

async function fetchHtml(url: string) {
	const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30_000) })
	if (!response.ok) {
		// A bot challenge page says so in its first few lines
		const body = textContent(await response.text().catch(() => '')).slice(0, 300)
		throw new Error(`${response.status} ${response.statusText}: ${url}\n  ${body}`)
	}
	return response.text()
}

/**
 * What a page that couldn't be read looks like, for the run's log: there's no way to see the page
 * from where the scraper is fixed, so the error has to describe it.
 */
export function describePage(html: string) {
	const title = textContent(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
	const tables = parseTables(html).map(
		({ headers, rows }, i) =>
			`  table ${i}: ${rows.length} rows; headers: ${JSON.stringify(headers)}; first row: ${JSON.stringify(rows[0]?.map(({ text }) => text.slice(0, 40)))}; first row links: ${JSON.stringify(rows[0]?.flatMap(({ html }) => [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1])))}`,
	)
	return [`  "${title}", ${html.length} chars, ${tables.length} tables`, ...tables].join('\n')
}

// --- Spotrac ---

const SPOTRAC = 'https://www.spotrac.com'

/** The team a Spotrac row belongs to, from its link to the team's page or else its text. */
function spotracRowTeam(row: Cell[], teams: StatsTeam[]) {
	for (const cell of row) {
		for (const [, href] of cell.html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
			const slug = href.match(/\/mlb\/([a-z0-9-]+)\//i)?.[1]
			const team = slug && matchTeam(slug.replace(/-/g, ' '), teams)
			if (team) return { team, href: new URL(href, SPOTRAC).toString() }
		}
	}
	for (const cell of row) {
		const team = cell.text && matchTeam(cell.text, teams)
		if (team) return { team, href: undefined }
	}
	return undefined
}

/** Reads the one table on a Spotrac page that has a team on every row and the wanted column. */
export function readSpotracTable(
	html: string,
	teams: StatsTeam[],
	column: { include: RegExp | RegExp[]; exclude?: RegExp },
) {
	for (const table of parseTables(html)) {
		const index = findColumn(table.headers, column.include, column.exclude)
		if (index < 0) continue

		const values = new Map<number, { value: number; href?: string }>()
		for (const row of table.rows) {
			const match = spotracRowTeam(row, teams)
			const value = parseDollars(row[index])
			if (match && value) values.set(match.team.id, { value, href: match.href })
		}
		if (values.size >= teams.length / 2) return { values, table, index }
	}
	return undefined
}

/** `load` fetches each page by default; reading saved pages, it maps the URL to a file instead. */
export async function scrapeSpotrac(
	season: number,
	teams: StatsTeam[],
	load: (url: string) => Promise<string> = fetchHtml,
): Promise<Scraped> {
	const payrollUrl = `${SPOTRAC}/mlb/payroll/_/year/${season}/`
	const taxUrl = `${SPOTRAC}/mlb/tax/_/year/${season}/`

	const html = await load(payrollUrl)
	const payroll = readSpotracTable(html, teams, {
		include: [/total.*payroll|payroll.*total/i, /payroll/i],
		exclude: /tax|cbt|rank|%/i,
	})
	if (!payroll) {
		throw new Error(`Spotrac: no payroll table found at ${payrollUrl}\n${describePage(html)}`)
	}

	// The luxury tax figures live on their own page; the payroll is still worth having without them.
	let tax: ReturnType<typeof readSpotracTable>
	let luxuryTaxThreshold: number | null = null
	try {
		const html = await load(taxUrl)
		tax = readSpotracTable(html, teams, {
			include: [/(tax|cbt).*payroll|payroll.*(tax|cbt)/i, /cbt|tax total/i, /total.*payroll/i],
			exclude: /space|bill|threshold|room|rank|over|under|%/i,
		})

		const threshold = tax && findColumn(tax.table.headers, /threshold/i)
		if (tax && threshold !== undefined && threshold >= 0) {
			luxuryTaxThreshold = parseDollars(tax.table.rows[0]?.[threshold])
		}
		luxuryTaxThreshold ??= parseDollars({
			text: textContent(html).match(/(?:tax|cbt) threshold[^$]{0,40}(\$[\d,.]+\s*M?)/i)?.[1] ?? '',
			html: '',
			attrs: {},
		})
	} catch (e) {
		console.warn(`Spotrac: skipping luxury tax payrolls (${(e as Error).message})`)
	}

	return {
		source: { name: 'Spotrac', url: payrollUrl },
		luxuryTaxThreshold,
		teams: [...payroll.values].map(([teamId, { value, href }]) => ({
			teamId,
			payroll: value,
			luxuryTaxPayroll: tax?.values.get(teamId)?.value ?? null,
			sourceUrl: href ?? payrollUrl,
		})),
	}
}

// --- FanGraphs RosterResource ---

const FANGRAPHS_URL = 'https://www.fangraphs.com/roster-resource/payroll'

/** Every array of objects anywhere in `value`. */
function* objectArrays(value: unknown): Generator<Record<string, unknown>[]> {
	if (Array.isArray(value)) {
		if (value.length && value.every((v) => v && typeof v === 'object' && !Array.isArray(v))) {
			yield value as Record<string, unknown>[]
		}
		for (const v of value) yield* objectArrays(v)
	} else if (value && typeof value === 'object') {
		for (const v of Object.values(value)) yield* objectArrays(v)
	}
}

/**
 * RosterResource is a Next.js page, so its table data ships as JSON in `__NEXT_DATA__`. The
 * field names aren't documented, so this looks for the array with a row per team and picks the
 * payroll fields by name.
 */
export function readFanGraphs(html: string, season: number, teams: StatsTeam[]): Scraped {
	const json = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1]
	if (!json) throw new Error(`FanGraphs: no __NEXT_DATA__ on the page\n${describePage(html)}`)

	const candidates: string[] = []
	for (const rows of objectArrays(JSON.parse(json))) {
		if (rows.length >= 20)
			candidates.push(`  ${rows.length} rows: ${JSON.stringify(rows[0])}`.slice(0, 600))
		if (rows.length < teams.length) continue

		const keys = Object.keys(rows[0])
		const numeric = (key: string) =>
			rows.every((row) => row[key] == null || typeof row[key] === 'number')
		const payrollKey =
			keys.find(
				(k) =>
					numeric(k) &&
					/^(total)?payroll$|total.?payroll|payroll.?total/i.test(k) &&
					!/tax|cbt|lux/i.test(k),
			) ?? keys.find((k) => numeric(k) && /payroll/i.test(k) && !/tax|cbt|lux|rank/i.test(k))
		if (!payrollKey) continue

		const taxKey = keys.find(
			(k) =>
				numeric(k) &&
				/(lux|cbt|tax)/i.test(k) &&
				/payroll|total|cbt/i.test(k) &&
				!/space|bill|threshold|room/i.test(k),
		)
		const teamKeys = keys.filter(
			(k) =>
				/team|abb|name|club/i.test(k) &&
				rows.every((row) => typeof row[k] === 'string' || row[k] == null),
		)

		const found = new Map<number, ScrapedTeam>()
		for (const row of rows) {
			const team = teamKeys.map((k) => matchTeam(String(row[k] ?? ''), teams)).find(Boolean)
			const payroll = row[payrollKey] as number | null
			if (!team || !payroll) continue

			found.set(team.id, {
				teamId: team.id,
				payroll,
				luxuryTaxPayroll: taxKey ? ((row[taxKey] as number | null) ?? null) : null,
				sourceUrl: FANGRAPHS_URL,
			})
		}
		if (found.size < teams.length) continue

		// Some tables carry payrolls in millions rather than dollars.
		const scale = Math.max(...[...found.values()].map(({ payroll }) => payroll)) < 10_000 ? 1e6 : 1
		return {
			source: { name: 'FanGraphs RosterResource', url: FANGRAPHS_URL },
			luxuryTaxThreshold: null,
			teams: [...found.values()].map((t) => ({
				...t,
				payroll: t.payroll * scale,
				luxuryTaxPayroll: t.luxuryTaxPayroll === null ? null : t.luxuryTaxPayroll * scale,
			})),
		}
	}

	throw new Error(
		`FanGraphs: no table with a payroll for every team in ${season}\n${candidates.join('\n') || '  no arrays of 20+ objects'}`,
	)
}

async function scrapeFanGraphs(season: number, teams: StatsTeam[]) {
	return readFanGraphs(await fetchHtml(FANGRAPHS_URL), season, teams)
}

// --- Output ---

/** Throws unless every team has exactly one plausible payroll. */
export function validate(scraped: Scraped, teams: StatsTeam[]) {
	const ids = new Set(scraped.teams.map(({ teamId }) => teamId))
	const missing = teams.filter(({ id }) => !ids.has(id)).map(({ name }) => name)
	if (missing.length) throw new Error(`missing ${missing.length} teams: ${missing.join(', ')}`)

	for (const { teamId, payroll, luxuryTaxPayroll } of scraped.teams) {
		for (const value of [payroll, luxuryTaxPayroll]) {
			if (value !== null && (value < MIN_PLAUSIBLE || value > MAX_PLAUSIBLE)) {
				throw new Error(`implausible payroll for team ${teamId}: ${value}`)
			}
		}
	}
}

export function toPayrollData(
	scraped: Scraped,
	season: number,
	teams: StatsTeam[],
	previous: PayrollData | null,
	now = new Date(),
): PayrollData {
	const byId = new Map(teams.map((team) => [team.id, team]))

	const rows: TeamPayroll[] = scraped.teams
		.map(({ teamId, payroll, luxuryTaxPayroll, sourceUrl }) => ({
			teamId,
			name: byId.get(teamId)!.name,
			abbreviation: byId.get(teamId)!.abbreviation,
			payroll: Math.round(payroll),
			luxuryTaxPayroll: luxuryTaxPayroll === null ? null : Math.round(luxuryTaxPayroll),
			sourceUrl,
		}))
		.sort((a, b) => b.payroll - a.payroll || a.teamId - b.teamId)

	const data: Omit<PayrollData, 'lastUpdated'> = {
		season,
		source: scraped.source,
		luxuryTaxThreshold: scraped.luxuryTaxThreshold ?? CBT_THRESHOLDS[season] ?? null,
		teams: rows,
	}

	// Only a change in the numbers moves the date, so an unchanged week makes no commit.
	const unchanged =
		previous &&
		JSON.stringify({ ...previous, lastUpdated: undefined }) ===
			JSON.stringify({ ...data, lastUpdated: undefined })

	return {
		season: data.season,
		lastUpdated: unchanged ? previous.lastUpdated : now.toISOString().slice(0, 10),
		source: data.source,
		luxuryTaxThreshold: data.luxuryTaxThreshold,
		teams: data.teams,
	}
}

/** Payrolls from pages saved out of a browser, rather than fetched. */
async function readSavedPages(
	season: number,
	teams: StatsTeam[],
	{ html: path, 'tax-html': taxPath }: { html?: string; 'tax-html'?: string },
) {
	const html = await readFile(path!, 'utf8')
	if (/fangraphs/i.test(html) && html.includes('__NEXT_DATA__')) {
		return readFanGraphs(html, season, teams)
	}

	return scrapeSpotrac(season, teams, async (url) => {
		if (!url.includes('/tax/')) return html
		if (!taxPath) throw new Error('no --tax-html given')
		return readFile(taxPath, 'utf8')
	})
}

async function main() {
	const { values } = parseArgs({
		options: {
			season: { type: 'string' },
			html: { type: 'string' },
			'tax-html': { type: 'string' },
			'dry-run': { type: 'boolean', default: false },
		},
	})

	const season = Number(
		values.season ??
			new Date().toLocaleString('en-US', { timeZone: 'America/New_York', year: 'numeric' }),
	)
	const teams = await fetchTeams(season)

	let scraped: Scraped | undefined
	const sources: [string, (season: number, teams: StatsTeam[]) => Promise<Scraped>][] = values.html
		? [[values.html, (season, teams) => readSavedPages(season, teams, values)]]
		: [
				['Spotrac', scrapeSpotrac],
				['FanGraphs', scrapeFanGraphs],
			]
	for (const [name, scrape] of sources) {
		try {
			const result = await scrape(season, teams)
			validate(result, teams)
			scraped = result
			break
		} catch (e) {
			console.warn(`${name} failed: ${(e as Error).message}`)
		}
	}
	if (!scraped) throw new Error('No source returned a payroll for every team')

	const previous = await readFile(OUTPUT, 'utf8')
		.then((text) => JSON.parse(text) as PayrollData)
		.catch(() => null)

	const data = toPayrollData(scraped, season, teams, previous)
	const output = `${JSON.stringify(data, null, '\t')}\n`

	if (values['dry-run']) {
		console.log(output)
		return
	}

	await writeFile(OUTPUT, output)
	console.log(
		`Wrote ${data.teams.length} ${season} payrolls from ${data.source.name} (updated ${data.lastUpdated})`,
	)
}

if (import.meta.main) {
	main().catch((e) => {
		console.error(e)
		process.exit(1)
	})
}
