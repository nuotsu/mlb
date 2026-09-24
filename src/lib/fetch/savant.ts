import { fetchMLB } from './index'

const HOST = 'https://baseballsavant.mlb.com'
const TIMEOUT_MS = 20_000

/**
 * Statcast search returns every batted ball for a season, which is a lot of CSV.
 * Narrow it with a projected-distance floor first and walk the floor down until
 * enough home runs come back — most seasons resolve on the first attempt.
 */
const DISTANCE_FLOORS = [430, 400, 0]

/** MLB game types → the values Savant's `hfGT` filter expects. */
const GAME_TYPES: Record<string, string> = {
	R: 'R',
	S: 'S',
	P: 'PO',
}

/**
 * Savant team codes that don't match the Stats API `abbreviation`, plus the
 * historical Stats API codes, so a lookup works from either direction.
 */
const TEAM_ALIASES: Record<string, string[]> = {
	AZ: ['ARI'],
	ARI: ['AZ'],
	CWS: ['CHW'],
	CHW: ['CWS'],
	KC: ['KAN'],
	KAN: ['KC'],
	SD: ['SDP', 'SDG'],
	SF: ['SFG'],
	TB: ['TBR', 'TAM'],
	WSH: ['WAS', 'WSN'],
	ATH: ['OAK'],
	OAK: ['ATH'],
	LAA: ['ANA'],
}

export interface LongestHomeRun {
	rank: number
	gamePk?: number
	date: string
	/** Projected distance, in feet. */
	distance: number
	launchSpeed?: number
	launchAngle?: number
	batter: Partial<MLB.Person>
	pitcher?: Partial<MLB.Person>
	team?: MLB.Team
	opponent?: MLB.Team
	isHome: boolean
	description?: string
}

/** Parse a CSV body into records keyed by header, tolerating quoted commas and newlines. */
function parseCSV(csv: string): Record<string, string>[] {
	const rows: string[][] = []
	let row: string[] = []
	let field = ''
	let quoted = false

	for (let i = 0; i < csv.length; i++) {
		const char = csv[i]

		if (quoted) {
			if (char === '"') {
				if (csv[i + 1] === '"') {
					field += '"'
					i++
				} else {
					quoted = false
				}
			} else {
				field += char
			}
			continue
		}

		if (char === '"') {
			quoted = true
		} else if (char === ',') {
			row.push(field)
			field = ''
		} else if (char === '\n' || char === '\r') {
			if (char === '\r' && csv[i + 1] === '\n') i++
			row.push(field)
			field = ''
			rows.push(row)
			row = []
		} else {
			field += char
		}
	}

	if (field || row.length) {
		row.push(field)
		rows.push(row)
	}

	const [header, ...body] = rows
	if (!header) return []

	return body
		.filter((cells) => cells.length > 1)
		.map((cells) => Object.fromEntries(header.map((key, i) => [key.trim(), cells[i] ?? ''])))
}

function toNumber(value?: string) {
	if (!value || value === 'null') return undefined
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : undefined
}

async function fetchStatcastSearch(
	params: Record<string, string>,
	_fetch: typeof fetch,
): Promise<Record<string, string>[]> {
	const url = new URL('/statcast_search/csv', HOST)

	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value)
	}

	const response = await _fetch(url.toString(), { signal: AbortSignal.timeout(TIMEOUT_MS) })

	if (!response.ok) {
		throw new Error(`Baseball Savant ${response.status}: ${url.pathname}`)
	}

	return parseCSV(await response.text())
}

/**
 * The season's longest home runs by projected distance, from Baseball Savant's
 * Statcast search, enriched with Stats API people and teams so the UI can render
 * headshots, team colors, and links.
 *
 * Savant only covers MLB (sportId 1).
 */
export async function fetchLongestHomeRuns(
	{
		season,
		gameType = 'R',
		limit = 20,
	}: { season: string | number; gameType?: string; limit?: number },
	{ fetch: _fetch = fetch }: { fetch?: typeof fetch } = {},
): Promise<LongestHomeRun[]> {
	let rows: Record<string, string>[] = []
	let lastError: unknown

	for (const floor of DISTANCE_FLOORS) {
		const attempt = await fetchStatcastSearch(
			{
				all: 'true',
				type: 'details',
				player_type: 'batter',
				hfAB: 'home\\.\\.run|',
				hfSea: `${season}|`,
				hfGT: `${GAME_TYPES[gameType] ?? 'R'}|`,
				...(floor ? { metric_1: 'api_h_distance_projected', metric_1_gt: String(floor) } : {}),
				min_pitches: '0',
				min_results: '0',
				min_abs: '0',
				group_by: 'name',
				sort_col: 'hit_distance_sc',
				player_event_sort: 'api_h_distance_projected',
				sort_order: 'desc',
			},
			_fetch,
		).catch((e) => {
			// A rejected filter shouldn't sink the section — try the next floor.
			lastError = e
			return [] as Record<string, string>[]
		})

		if (attempt.length > rows.length) rows = attempt
		if (rows.length >= limit) break
	}

	if (!rows.length && lastError) throw lastError

	const homeRuns = rows
		.filter((row) => row.events === 'home_run')
		.map((row) => ({
			gamePk: toNumber(row.game_pk),
			date: row.game_date,
			distance: toNumber(row.hit_distance_sc),
			launchSpeed: toNumber(row.launch_speed),
			launchAngle: toNumber(row.launch_angle),
			batterId: toNumber(row.batter),
			pitcherId: toNumber(row.pitcher),
			description: row.des,
			isHome: row.inning_topbot?.toLowerCase().startsWith('bot') ?? false,
			homeTeam: row.home_team,
			awayTeam: row.away_team,
		}))
		.filter((hr) => hr.distance != null)
		.sort((a, b) => b.distance! - a.distance! || (b.launchSpeed ?? 0) - (a.launchSpeed ?? 0))
		.slice(0, limit)

	if (!homeRuns.length) return []

	const personIds = [
		...new Set(homeRuns.flatMap((hr) => [hr.batterId, hr.pitcherId]).filter(Boolean)),
	] as number[]

	const [people, teams] = await Promise.all([
		fetchMLB<{ people: MLB.Person[] }>(
			'/api/v1/people',
			{
				personIds: personIds.join(','),
				fields: 'people,id,fullName,lastName,boxscoreName,useLastName',
			},
			{ fetch: _fetch },
		)
			.then((r) => r.people ?? [])
			.catch(() => [] as MLB.Person[]),
		fetchMLB<MLB.TeamsResponse>(
			'/api/v1/teams',
			{ sportId: '1', season: String(season), fields: 'teams,id,name,teamName,abbreviation' },
			{ fetch: _fetch },
		)
			.then((r) => r.teams ?? [])
			.catch(() => [] as MLB.Team[]),
	])

	const peopleById = new Map(people.map((person) => [person.id, person]))

	const teamsByCode = new Map<string, MLB.Team>()
	for (const team of teams) {
		const code = team.abbreviation?.toUpperCase()
		if (!code) continue
		for (const key of [code, ...(TEAM_ALIASES[code] ?? [])]) {
			if (!teamsByCode.has(key)) teamsByCode.set(key, team)
		}
	}

	const lookupTeam = (code?: string) => (code ? teamsByCode.get(code.toUpperCase()) : undefined)

	return homeRuns.map((hr, i) => ({
		rank: i + 1,
		gamePk: hr.gamePk,
		date: hr.date,
		distance: hr.distance!,
		launchSpeed: hr.launchSpeed,
		launchAngle: hr.launchAngle,
		batter: (hr.batterId ? peopleById.get(hr.batterId) : undefined) ?? { id: hr.batterId },
		pitcher: hr.pitcherId ? (peopleById.get(hr.pitcherId) ?? { id: hr.pitcherId }) : undefined,
		team: lookupTeam(hr.isHome ? hr.homeTeam : hr.awayTeam),
		opponent: lookupTeam(hr.isHome ? hr.awayTeam : hr.homeTeam),
		isHome: hr.isHome,
		description: hr.description,
	}))
}

/** Pitch codes that aren't real offerings: pitchouts, intentional and automatic balls/strikes, unknown. */
const NON_PITCHES = new Set(['PO', 'FO', 'IN', 'AB', 'AS', 'UN'])

export interface PitchArsenalPitch {
	/** Statcast pitch code, e.g. `FF`. */
	code: string
	name: string
	count: number
	/** Share of the pitcher's tracked pitches, 0–1. */
	usage: number
	/** Release speed in mph. */
	speed: { min: number; avg: number; max: number }
	/** Induced vertical break in inches. Positive is rise relative to a spinless pitch. */
	verticalBreak?: { low: number; avg: number; high: number }
	/** Horizontal break in inches from the pitcher's view. Positive is arm side. */
	horizontalBreak?: { low: number; avg: number; high: number }
}

function percentile(sorted: number[], p: number) {
	const index = (sorted.length - 1) * p
	const lower = Math.floor(index)
	const upper = Math.ceil(index)
	return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}

const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length

/**
 * Movement spreads are the 10th–90th percentile so a few mis-tracked or
 * mis-tagged pitches don't stretch the range. Speed keeps its true min and max.
 */
function spread(values: number[]) {
	if (!values.length) return undefined
	const sorted = [...values].sort((a, b) => a - b)
	return { low: percentile(sorted, 0.1), avg: average(values), high: percentile(sorted, 0.9) }
}

/** Group Statcast pitch rows by pitch type into usage, speed, and movement. */
export function summarizeArsenal(rows: Record<string, string>[]): PitchArsenalPitch[] {
	const byType = new Map<
		string,
		{ name: string; count: number; speeds: number[]; vertical: number[]; horizontal: number[] }
	>()

	for (const row of rows) {
		const code = row.pitch_type?.trim()
		if (!code || NON_PITCHES.has(code)) continue

		const entry = byType.get(code) ?? {
			name: row.pitch_name?.trim() || code,
			count: 0,
			speeds: [],
			vertical: [],
			horizontal: [],
		}
		entry.count++

		const speed = toNumber(row.release_speed)
		if (speed != null) entry.speeds.push(speed)

		// pfx_* are feet from the catcher's view; flip x for righties so arm side is positive.
		const pfxX = toNumber(row.pfx_x)
		const pfxZ = toNumber(row.pfx_z)
		if (pfxZ != null) entry.vertical.push(pfxZ * 12)
		if (pfxX != null) entry.horizontal.push(pfxX * 12 * (row.p_throws === 'R' ? -1 : 1))

		byType.set(code, entry)
	}

	const total = [...byType.values()].reduce((sum, { count }) => sum + count, 0)

	return [...byType.entries()]
		.filter(([, { speeds }]) => speeds.length)
		.map(([code, { name, count, speeds, vertical, horizontal }]) => ({
			code,
			name,
			count,
			usage: count / total,
			speed: { min: Math.min(...speeds), avg: average(speeds), max: Math.max(...speeds) },
			verticalBreak: spread(vertical),
			horizontalBreak: spread(horizontal),
		}))
		.sort((a, b) => b.count - a.count)
}

/**
 * A pitcher's regular-season arsenal from Baseball Savant's pitch-level
 * Statcast search. Savant only covers MLB, with pitch tracking from 2008 on.
 */
export async function fetchPitchArsenal(
	{ personId, season }: { personId: string | number; season: string | number },
	{ fetch: _fetch = fetch }: { fetch?: typeof fetch } = {},
): Promise<PitchArsenalPitch[]> {
	const rows = await fetchStatcastSearch(
		{
			all: 'true',
			type: 'details',
			player_type: 'pitcher',
			'pitchers_lookup[]': String(personId),
			hfSea: `${season}|`,
			hfGT: 'R|',
			min_pitches: '0',
			min_results: '0',
			min_abs: '0',
			group_by: 'name',
			sort_col: 'pitches',
			player_event_sort: 'api_p_release_speed',
			sort_order: 'desc',
		},
		_fetch,
	)

	return summarizeArsenal(rows)
}
