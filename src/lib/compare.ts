/**
 * Player comparison: a curated stat catalog keyed by the JSON keys the Stats API actually
 * returns, plus helpers to pick the right split and rank players per stat.
 */

export type CompareGroup = 'hitting' | 'pitching' | 'fielding'

export type StatDef = {
	/** Key in the split's `stat` object */
	key: string
	/** Short column label, e.g. `HR` */
	abbr: string
	/** Full name, e.g. `Home runs` */
	label: string
	/** A smaller value is the better one */
	lower?: boolean
	/** Neither direction is better, so the stat is shown but never highlighted */
	neutral?: boolean
	/** Selected by the "Standard" preset */
	standard?: boolean
}

export type StatCategory = { id: string; label: string; stats: StatDef[] }

export const COMPARE_STATS: Record<CompareGroup, StatCategory[]> = {
	hitting: [
		{
			id: 'slash',
			label: 'Slash line',
			stats: [
				{ key: 'avg', abbr: 'AVG', label: 'Batting average', standard: true },
				{ key: 'obp', abbr: 'OBP', label: 'On-base percentage', standard: true },
				{ key: 'slg', abbr: 'SLG', label: 'Slugging percentage', standard: true },
				{ key: 'ops', abbr: 'OPS', label: 'On-base plus slugging', standard: true },
			],
		},
		{
			id: 'production',
			label: 'Production',
			stats: [
				{ key: 'gamesPlayed', abbr: 'G', label: 'Games played', standard: true },
				{ key: 'plateAppearances', abbr: 'PA', label: 'Plate appearances', standard: true },
				{ key: 'atBats', abbr: 'AB', label: 'At bats' },
				{ key: 'runs', abbr: 'R', label: 'Runs', standard: true },
				{ key: 'hits', abbr: 'H', label: 'Hits', standard: true },
				{ key: 'doubles', abbr: '2B', label: 'Doubles' },
				{ key: 'triples', abbr: '3B', label: 'Triples' },
				{ key: 'homeRuns', abbr: 'HR', label: 'Home runs', standard: true },
				{ key: 'rbi', abbr: 'RBI', label: 'Runs batted in', standard: true },
				{ key: 'extraBaseHits', abbr: 'XBH', label: 'Extra-base hits' },
				{ key: 'totalBases', abbr: 'TB', label: 'Total bases' },
			],
		},
		{
			id: 'discipline',
			label: 'Plate discipline',
			stats: [
				{ key: 'baseOnBalls', abbr: 'BB', label: 'Walks', standard: true },
				{ key: 'intentionalWalks', abbr: 'IBB', label: 'Intentional walks' },
				{ key: 'hitByPitch', abbr: 'HBP', label: 'Hit by pitch' },
				{ key: 'strikeOuts', abbr: 'SO', label: 'Strikeouts', lower: true, standard: true },
				{ key: 'walksPerPlateAppearance', abbr: 'BB/PA', label: 'Walks per PA' },
				{
					key: 'strikeoutsPerPlateAppearance',
					abbr: 'K/PA',
					label: 'Strikeouts per PA',
					lower: true,
				},
				{ key: 'walksPerStrikeout', abbr: 'BB/K', label: 'Walks per strikeout' },
				{ key: 'pitchesPerPlateAppearance', abbr: 'P/PA', label: 'Pitches per PA' },
			],
		},
		{
			id: 'contact',
			label: 'Batted ball',
			stats: [
				{ key: 'babip', abbr: 'BABIP', label: 'Batting avg. on balls in play' },
				{ key: 'iso', abbr: 'ISO', label: 'Isolated power' },
				{ key: 'atBatsPerHomeRun', abbr: 'AB/HR', label: 'At bats per home run', lower: true },
				{ key: 'homeRunsPerPlateAppearance', abbr: 'HR/PA', label: 'Home runs per PA' },
				{
					key: 'groundOutsToAirouts',
					abbr: 'GO/AO',
					label: 'Ground outs to air outs',
					neutral: true,
				},
				{
					key: 'groundIntoDoublePlay',
					abbr: 'GIDP',
					label: 'Grounded into double plays',
					lower: true,
				},
				{ key: 'leftOnBase', abbr: 'LOB', label: 'Left on base', lower: true },
				{ key: 'sacFlies', abbr: 'SF', label: 'Sacrifice flies' },
				{ key: 'sacBunts', abbr: 'SAC', label: 'Sacrifice bunts', neutral: true },
				{ key: 'reachedOnError', abbr: 'ROE', label: 'Reached on error', neutral: true },
			],
		},
		{
			id: 'baserunning',
			label: 'Baserunning',
			stats: [
				{ key: 'stolenBases', abbr: 'SB', label: 'Stolen bases', standard: true },
				{ key: 'caughtStealing', abbr: 'CS', label: 'Caught stealing', lower: true },
				{ key: 'stolenBasePercentage', abbr: 'SB%', label: 'Stolen base percentage' },
			],
		},
	],
	pitching: [
		{
			id: 'prevention',
			label: 'Run prevention',
			stats: [
				{ key: 'era', abbr: 'ERA', label: 'Earned run average', lower: true, standard: true },
				{
					key: 'whip',
					abbr: 'WHIP',
					label: 'Walks + hits per inning',
					lower: true,
					standard: true,
				},
				{ key: 'avg', abbr: 'AVG', label: 'Opponent batting average', lower: true, standard: true },
				{ key: 'obp', abbr: 'OBP', label: 'Opponent on-base percentage', lower: true },
				{ key: 'slg', abbr: 'SLG', label: 'Opponent slugging', lower: true },
				{ key: 'ops', abbr: 'OPS', label: 'Opponent OPS', lower: true },
				{ key: 'babip', abbr: 'BABIP', label: 'Opponent BABIP', lower: true },
				{ key: 'earnedRuns', abbr: 'ER', label: 'Earned runs', lower: true },
				{ key: 'runs', abbr: 'R', label: 'Runs allowed', lower: true },
			],
		},
		{
			id: 'results',
			label: 'Results',
			stats: [
				{ key: 'wins', abbr: 'W', label: 'Wins', standard: true },
				{ key: 'losses', abbr: 'L', label: 'Losses', lower: true, standard: true },
				{ key: 'winPercentage', abbr: 'W%', label: 'Win percentage' },
				{ key: 'saves', abbr: 'SV', label: 'Saves', standard: true },
				{ key: 'saveOpportunities', abbr: 'SVO', label: 'Save opportunities', neutral: true },
				{ key: 'holds', abbr: 'HLD', label: 'Holds' },
				{ key: 'blownSaves', abbr: 'BS', label: 'Blown saves', lower: true },
			],
		},
		{
			id: 'workload',
			label: 'Workload',
			stats: [
				{ key: 'gamesPitched', abbr: 'G', label: 'Games pitched', standard: true },
				{ key: 'gamesStarted', abbr: 'GS', label: 'Games started', standard: true },
				{ key: 'inningsPitched', abbr: 'IP', label: 'Innings pitched', standard: true },
				{ key: 'qualityStarts', abbr: 'QS', label: 'Quality starts' },
				{ key: 'completeGames', abbr: 'CG', label: 'Complete games' },
				{ key: 'shutouts', abbr: 'SHO', label: 'Shutouts' },
				{ key: 'gamesFinished', abbr: 'GF', label: 'Games finished', neutral: true },
				{ key: 'battersFaced', abbr: 'TBF', label: 'Batters faced', neutral: true },
				{ key: 'numberOfPitches', abbr: 'NP', label: 'Pitches thrown', neutral: true },
				{ key: 'pitchesPerInning', abbr: 'P/IP', label: 'Pitches per inning', lower: true },
			],
		},
		{
			id: 'k-bb',
			label: 'Strikeouts & walks',
			stats: [
				{ key: 'strikeOuts', abbr: 'SO', label: 'Strikeouts', standard: true },
				{ key: 'baseOnBalls', abbr: 'BB', label: 'Walks', lower: true, standard: true },
				{ key: 'strikeoutsPer9Inn', abbr: 'K/9', label: 'Strikeouts per 9', standard: true },
				{ key: 'walksPer9Inn', abbr: 'BB/9', label: 'Walks per 9', lower: true },
				{ key: 'strikeoutWalkRatio', abbr: 'K/BB', label: 'Strikeout-to-walk ratio' },
				{
					key: 'strikeoutsMinusWalksPercentage',
					abbr: 'K-BB%',
					label: 'Strikeout minus walk rate',
				},
				{ key: 'whiffPercentage', abbr: 'Whiff%', label: 'Whiff rate' },
				{ key: 'strikePercentage', abbr: 'Strike%', label: 'Strike percentage' },
				{ key: 'intentionalWalks', abbr: 'IBB', label: 'Intentional walks', lower: true },
			],
		},
		{
			id: 'contact',
			label: 'Contact allowed',
			stats: [
				{ key: 'hits', abbr: 'H', label: 'Hits allowed', lower: true },
				{ key: 'homeRuns', abbr: 'HR', label: 'Home runs allowed', lower: true, standard: true },
				{ key: 'hitsPer9Inn', abbr: 'H/9', label: 'Hits per 9', lower: true },
				{ key: 'homeRunsPer9', abbr: 'HR/9', label: 'Home runs per 9', lower: true },
				{
					key: 'groundOutsToAirouts',
					abbr: 'GO/AO',
					label: 'Ground outs to air outs',
					neutral: true,
				},
				{ key: 'gidp', abbr: 'GIDP', label: 'Double plays induced' },
				{ key: 'hitBatsmen', abbr: 'HBP', label: 'Hit batters', lower: true },
				{ key: 'wildPitches', abbr: 'WP', label: 'Wild pitches', lower: true },
				{ key: 'balks', abbr: 'BK', label: 'Balks', lower: true },
				{ key: 'pickoffs', abbr: 'PK', label: 'Pickoffs' },
			],
		},
		{
			id: 'relief',
			label: 'Inherited runners',
			stats: [
				{ key: 'inheritedRunners', abbr: 'IR', label: 'Inherited runners', neutral: true },
				{
					key: 'inheritedRunnersScored',
					abbr: 'IRS',
					label: 'Inherited runners scored',
					lower: true,
				},
				{ key: 'bequeathedRunners', abbr: 'BQR', label: 'Bequeathed runners', lower: true },
				{
					key: 'bequeathedRunnersScored',
					abbr: 'BQRS',
					label: 'Bequeathed runners scored',
					lower: true,
				},
			],
		},
	],
	fielding: [
		{
			id: 'defense',
			label: 'Defense',
			stats: [
				{ key: 'gamesPlayed', abbr: 'G', label: 'Games in the field', standard: true },
				{ key: 'gamesStarted', abbr: 'GS', label: 'Games started', standard: true },
				{ key: 'innings', abbr: 'INN', label: 'Innings', standard: true },
				{ key: 'chances', abbr: 'TC', label: 'Total chances', standard: true },
				{ key: 'putOuts', abbr: 'PO', label: 'Putouts', standard: true },
				{ key: 'assists', abbr: 'A', label: 'Assists', standard: true },
				{ key: 'errors', abbr: 'E', label: 'Errors', lower: true, standard: true },
				{ key: 'throwingErrors', abbr: 'TE', label: 'Throwing errors', lower: true },
				{ key: 'doublePlays', abbr: 'DP', label: 'Double plays', standard: true },
				{ key: 'fielding', abbr: 'FPCT', label: 'Fielding percentage', standard: true },
				{ key: 'rangeFactorPer9Inn', abbr: 'RF/9', label: 'Range factor per 9', standard: true },
				{ key: 'rangeFactorPerGame', abbr: 'RF/G', label: 'Range factor per game' },
			],
		},
		{
			id: 'catching',
			label: 'Catching',
			stats: [
				{ key: 'caughtStealing', abbr: 'CS', label: 'Runners caught stealing' },
				{ key: 'stolenBases', abbr: 'SB', label: 'Stolen bases allowed', lower: true },
				{ key: 'caughtStealingPercentage', abbr: 'CS%', label: 'Caught stealing percentage' },
				{ key: 'passedBall', abbr: 'PB', label: 'Passed balls', lower: true },
				{ key: 'catcherERA', abbr: 'CERA', label: 'Catcher ERA', lower: true },
				{ key: 'catchersInterference', abbr: 'CI', label: 'Catcher’s interference', lower: true },
			],
		},
	],
}

export function statsFor(group: CompareGroup) {
	return COMPARE_STATS[group].flatMap((c) => c.stats)
}

export function standardKeys(group: CompareGroup) {
	return statsFor(group)
		.filter((s) => s.standard)
		.map((s) => s.key)
}

/** `195.1` innings means 195⅓ */
export function parseInnings(value: string | number) {
	const [whole, thirds = '0'] = String(value).split('.')
	return Number(whole) + Number(thirds) / 3
}

function formatInnings(innings: number) {
	const whole = Math.floor(innings + 1e-9)
	return `${whole}.${Math.round((innings - whole) * 3)}`
}

const INNINGS_KEYS = new Set(['inningsPitched', 'innings'])

/** A comparable number, or `undefined` for blanks like `-.--` */
export function toNumber(key: string, value: unknown) {
	if (value == null || value === '') return undefined
	const n = INNINGS_KEYS.has(key) ? parseInnings(value as string) : Number(value)
	return Number.isFinite(n) ? n : undefined
}

type Stat = Record<string, number | string>

/**
 * A player traded mid-season gets one split per team plus a team-less total, which comes
 * first, so pick the total rather than whichever team happens to be last
 */
function totalSplit(splits: MLB.StatSplit[]) {
	return splits.find((s) => !s.team) ?? splits[0]
}

/**
 * Fielding has one split per position (and per team), but no overall total, so sum the
 * counting stats and recompute the rates. DH splits are all zeros and are left out.
 */
export function combineFielding(splits: MLB.StatSplit[]): Stat {
	const byTeam = splits.some((s) => s.team) ? splits.filter((s) => s.team) : splits
	const fielded = byTeam.filter((s) => (s.stat.position as unknown as MLB.Position)?.code !== '10')
	if (fielded.length <= 1) return { ...fielded[0]?.stat }

	const total: Stat = {}
	for (const { stat } of fielded) {
		for (const [key, value] of Object.entries(stat)) {
			if (typeof value === 'number') total[key] = ((total[key] as number) ?? 0) + value
		}
	}

	const innings = fielded.reduce((sum, s) => sum + parseInnings(s.stat.innings ?? 0), 0)
	const plays = ((total.putOuts as number) ?? 0) + ((total.assists as number) ?? 0)
	const chances = plays + ((total.errors as number) ?? 0)
	const games = (total.gamesPlayed as number) ?? 0
	const steals = ((total.stolenBases as number) ?? 0) + ((total.caughtStealing as number) ?? 0)

	total.innings = formatInnings(innings)
	if (chances) total.fielding = (plays / chances).toFixed(3).replace(/^0/, '')
	if (innings) total.rangeFactorPer9Inn = ((plays * 9) / innings).toFixed(2)
	if (games) total.rangeFactorPerGame = (plays / games).toFixed(2)
	if (steals)
		total.caughtStealingPercentage = (((total.caughtStealing as number) ?? 0) / steals)
			.toFixed(3)
			.replace(/^0/, '')

	// Catcher ERA only exists on the catcher split
	const catcher = fielded.find((s) => s.stat.catcherERA != null)
	if (catcher) total.catcherERA = catcher.stat.catcherERA

	return total
}

/** Merge every stat type (e.g. `season` + `seasonAdvanced`) into one flat object */
export function combineStats(stats: MLB.PlayerStats[] | undefined, group: CompareGroup): Stat {
	const combined: Stat = {}
	for (const { splits } of stats ?? []) {
		if (!splits?.length) continue
		const stat = group === 'fielding' ? combineFielding(splits) : totalSplit(splits).stat
		// The first type (the standard one) wins over the advanced one for shared keys
		for (const [key, value] of Object.entries(stat)) combined[key] ??= value
	}
	return combined
}

/** Positions played, most games first (fielding only) */
export function positionsPlayed(stats: MLB.PlayerStats[] | undefined) {
	const games = new Map<string, number>()
	for (const { splits } of stats ?? []) {
		for (const { stat } of splits ?? []) {
			const abbr = (stat.position as unknown as MLB.Position)?.abbreviation
			if (!abbr || abbr === 'DH') continue
			games.set(abbr, (games.get(abbr) ?? 0) + Number(stat.gamesPlayed ?? 0))
		}
	}
	return [...games].sort((a, b) => b[1] - a[1]).map(([abbr]) => abbr)
}

export type Verdict = 'best' | 'worst' | undefined

export type Cell = {
	display: string
	value?: number
	verdict: Verdict
}

/** Rank one stat across players: the best gets `best`, the worst `worst`, ties included */
export function compareRow(def: StatDef, raw: unknown[]): Cell[] {
	const values = raw.map((v) => toNumber(def.key, v))
	const nums = values.filter((n): n is number => n != null)

	const ranked = !def.neutral && nums.length >= 2 && new Set(nums).size > 1
	const best = def.lower ? Math.min(...nums) : Math.max(...nums)
	const worst = def.lower ? Math.max(...nums) : Math.min(...nums)

	return values.map((value, i) => ({
		display: raw[i] == null || raw[i] === '' ? '–' : String(raw[i]),
		value,
		verdict:
			!ranked || value == null
				? undefined
				: value === best
					? 'best'
					: value === worst
						? 'worst'
						: undefined,
	}))
}

export type ComparePlayer = {
	id: number
	fullName: string
	position?: string
	teamId?: number
	stat: Stat
}

export type CompareRow = { def: StatDef; cells: Cell[] }
export type CompareSection = { id: string; label: string; rows: CompareRow[] }

/**
 * The selected stats, grouped by category. Rows that no player has a value for are dropped,
 * so a pitcher-only or catcher-only stat doesn't leave a column of dashes.
 */
export function buildSections(
	group: CompareGroup,
	players: ComparePlayer[],
	selected: Set<string>,
): CompareSection[] {
	return COMPARE_STATS[group]
		.map(({ id, label, stats }) => ({
			id,
			label,
			rows: stats
				.filter((def) => selected.has(def.key))
				.map((def) => ({
					def,
					cells: compareRow(
						def,
						players.map((p) => p.stat[def.key]),
					),
				}))
				.filter((row) => row.cells.some((c) => c.value != null)),
		}))
		.filter((s) => s.rows.length)
}

/** How many ranked stats each player leads, out of how many were ranked */
export function tallyLeads(sections: CompareSection[], count: number) {
	const leads = Array<number>(count).fill(0)
	let ranked = 0
	for (const { rows } of sections) {
		for (const { cells } of rows) {
			if (!cells.some((c) => c.verdict)) continue
			ranked++
			cells.forEach((c, i) => c.verdict === 'best' && leads[i]++)
		}
	}
	return { leads, ranked }
}

/** Light green for the best value, light red for the worst */
export const VERDICT_CLASS: Record<NonNullable<Verdict>, string> = {
	best: 'bg-green-500/15 positive',
	worst: 'bg-red-500/10 negative',
}
