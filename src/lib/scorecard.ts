/**
 * Scorecard notation, built from the live feed's `liveData.plays.allPlays`.
 *
 * Each plate appearance becomes a cell with a short scorer's abbreviation
 * (`1B`, `BB`, `K`, `6-3`, `F8`…), and the lineup's rows and the innings'
 * columns are laid out the way a paper scorecard would: substitutes get a row
 * under the player they replaced, and an inning gets a second column when the
 * order bats around.
 */

/** What a cell is colored by. */
export type ScorecardKind =
	'hit' | 'homeRun' | 'walk' | 'strikeout' | 'error' | 'fieldersChoice' | 'out' | 'runner' | 'other'

export type Notation = {
	label: string
	kind: ScorecardKind
	/** Backwards, for a called third strike. */
	mirrored?: boolean
	badge?: 'DP' | 'TP'
	/** Bases a hit was worth, 1 to 4, for the base paths to draw. */
	bases?: number
}

export type ScorecardCell = Notation & {
	atBatIndex: number
	inning: number
	/** 0 for the inning's first time through the order, 1 once it bats around, and so on. */
	column: number
	playerId: number
	/** The out this player made, 1 to 3, whether at the plate or later on the bases. */
	out?: number
	rbi: number
	/** The batter (or whoever ran for them) came around to score. */
	scored: boolean
	/** A run crossed the plate on this play. */
	isScoringPlay: boolean
	description: string
}

export type BattingTotals = {
	ab: number
	r: number
	h: number
	rbi: number
	bb: number
	k: number
}

export type HalfInning = { inning: number; half: 'top' | 'bottom' }

export type ScorecardRow = {
	playerId: number
	/** Lineup slot, 1 to 9. */
	slot: number
	/** `battingOrder` as a number: 100 for the leadoff starter, 101 for the first player to replace them. */
	order: number
	isSubstitute: boolean
	enteredInning?: number
	/** When a substitute came in. Unset for starters. */
	entered?: HalfInning
	/** When the next player in this lineup spot replaced them. Unset while they're still in the game. */
	exited?: HalfInning
	cells: ScorecardCell[]
	totals: BattingTotals
}

export type InningTotals = {
	runs: number
	hits: number
	errors: number
	/** Unset until the half-inning is over. */
	lob?: number
}

export type ScorecardInning = {
	inning: number
	columns: number
	/** Unset until this team has batted in the inning. */
	totals?: InningTotals
}

export type Scorecard = {
	innings: ScorecardInning[]
	rows: ScorecardRow[]
}

export type LineupEntry = {
	playerId: number
	/** `battingOrder` from the boxscore, like `"100"` or `"601"`. */
	battingOrder: string
}

const HITS: Record<string, { label: string; bases: number }> = {
	single: { label: '1B', bases: 1 },
	double: { label: '2B', bases: 2 },
	triple: { label: '3B', bases: 3 },
	home_run: { label: 'HR', bases: 4 },
}

const WALKS: Record<string, string> = {
	walk: 'BB',
	intent_walk: 'IBB',
	hit_by_pitch: 'HBP',
}

const DOUBLE_PLAYS = new Set([
	'grounded_into_double_play',
	'double_play',
	'strikeout_double_play',
	'sac_fly_double_play',
	'sac_bunt_double_play',
])

const TRIPLE_PLAYS = new Set(['triple_play', 'grounded_into_triple_play', 'strikeout_triple_play'])

const STRIKEOUTS = new Set(['strikeout', 'strikeout_double_play', 'strikeout_triple_play'])

const FIELDERS_CHOICES = new Set(['fielders_choice', 'fielders_choice_out', 'force_out'])

/** Plate appearances that don't count as an at-bat. */
const NOT_AT_BATS = new Set([
	'walk',
	'intent_walk',
	'hit_by_pitch',
	'sac_fly',
	'sac_fly_double_play',
	'sac_bunt',
	'sac_bunt_double_play',
	'catcher_interf',
])

/** Fielders credited with handling the ball on an out, in order. */
const OUT_CREDITS = new Set(['f_assist', 'f_assist_of', 'f_putout'])

function isError(credit?: string) {
	return !!credit?.includes('error')
}

/** Fielding positions that handled a runner's out, like `[6, 4]` for a force at second. */
function outChain(runner: MLB.Runner) {
	return (runner.credits ?? [])
		.filter((c) => OUT_CREDITS.has(c.credit))
		.map((c) => c.position?.code)
		.filter(Boolean)
}

/** Joins each out's chain in the order the outs were made, so 6-4 and 4-3 read 6-4-3. */
function mergedChain(play: MLB.Play) {
	const outs = (play.runners ?? [])
		.filter((r) => r.movement?.isOut)
		.sort((a, b) => (a.movement.outNumber ?? 0) - (b.movement.outNumber ?? 0))

	const chain: string[] = []
	for (const runner of outs) {
		for (const position of outChain(runner)) {
			if (chain.at(-1) !== position) chain.push(position)
		}
	}
	return chain
}

function batterRunner(play: MLB.Play) {
	const batterId = play.matchup?.batter?.id
	return play.runners?.find((r) => r.details?.runner?.id === batterId && !r.movement?.start)
}

/** `F`, `L` or `P` for a ball caught in the air, judged by how the feed words it. */
function caughtPrefix(play: MLB.Play) {
	const text = `${play.result?.event ?? ''} ${play.result?.description ?? ''}`.toLowerCase()
	if (/\bpops? (out|into)|pop out|pop up/.test(text)) return 'P'
	if (/\blines? (out|into)|lineout/.test(text)) return 'L'
	if (/\bflies (out|into)|flyout|fly out/.test(text)) return 'F'
}

function isCalledStrikeout(play: MLB.Play) {
	const lastPitch = play.playEvents?.findLast((e) => e.isPitch)
	const code = lastPitch?.details?.code ?? lastPitch?.details?.call?.code
	if (code) return code === 'C'
	return /called out on strikes/i.test(play.result?.description ?? '')
}

/** `Catcher Interference` → `CI`, `Balk` → `Balk`. */
function shortName(event: string) {
	const words = event.split(/\s+/).filter(Boolean)
	if (words.length < 2) return event
	return words.map((w) => w[0].toUpperCase()).join('')
}

/** The scorer's shorthand for how a plate appearance ended. */
export function notation(play: MLB.Play): Notation {
	const eventType = play.result?.eventType ?? ''
	const badge = DOUBLE_PLAYS.has(eventType) ? 'DP' : TRIPLE_PLAYS.has(eventType) ? 'TP' : undefined

	if (eventType in HITS) {
		const { label, bases } = HITS[eventType]
		return { label, bases, kind: eventType === 'home_run' ? 'homeRun' : 'hit' }
	}

	if (eventType in WALKS) return { label: WALKS[eventType], kind: 'walk' }

	if (STRIKEOUTS.has(eventType)) {
		return { label: 'K', kind: 'strikeout', mirrored: isCalledStrikeout(play), badge }
	}

	if (eventType === 'catcher_interf') return { label: 'CI', kind: 'error' }

	if (eventType === 'field_error') {
		// The batter's own entry names the fielder; other runners can carry later errors
		const credits = [batterRunner(play), ...(play.runners ?? [])].flatMap((r) => r?.credits ?? [])
		const position = credits.find((c) => isError(c.credit))?.position?.code
		return { label: `E${position ?? ''}`, kind: 'error' }
	}

	if (FIELDERS_CHOICES.has(eventType)) return { label: 'FC', kind: 'fieldersChoice' }

	if (eventType === 'sac_fly' || eventType === 'sac_fly_double_play') {
		return { label: 'SF', kind: 'out', badge }
	}

	if (eventType === 'sac_bunt' || eventType === 'sac_bunt_double_play') {
		return { label: 'SAC', kind: 'out', badge }
	}

	if (eventType === 'field_out' || badge) {
		const batter = batterRunner(play)
		const batterChain = batter ? outChain(batter) : []
		const prefix = caughtPrefix(play)

		// Caught on the fly: F8, L6, P4, and on a double play off the catch, L6-3
		if (prefix && batterChain.length === 1) {
			const rest = badge ? mergedChain(play) : []
			const chain = rest[0] === batterChain[0] ? rest : [batterChain[0], ...rest]
			return { label: `${prefix}${chain.join('-')}`, kind: 'out', badge }
		}

		const chain = badge ? mergedChain(play) : batterChain
		if (chain.length === 1) return { label: `${chain[0]}U`, kind: 'out', badge }
		if (chain.length) return { label: chain.join('-'), kind: 'out', badge }
	}

	return {
		label: shortName(play.result?.event || eventType || '?'),
		kind: play.result?.isOut || play.about?.hasOut ? 'out' : 'other',
		badge,
	}
}

/** The batter finished their plate appearance, as opposed to the inning ending with a runner caught stealing. */
export function isPlateAppearance(play: MLB.Play) {
	return play.about?.isComplete !== false && !!batterRunner(play)
}

/** The lineup from the boxscore: everyone with a batting order spot, in order. */
export function lineupFromBoxscore(team?: MLB.TeamBoxscore | null): LineupEntry[] {
	return Object.values(team?.players ?? {})
		.filter((p) => p.battingOrder)
		.map((p) => ({ playerId: p.person.id, battingOrder: p.battingOrder! }))
		.sort((a, b) => Number(a.battingOrder) - Number(b.battingOrder))
}

const SUBSTITUTIONS = new Set(['offensive_substitution', 'defensive_substitution'])

/** The inning each substitute came into the game. */
/** The half-inning each substitute came into the game. */
function entryInnings(plays: MLB.Play[]) {
	const innings = new Map<number, HalfInning>()
	for (const play of plays) {
		for (const event of play.playEvents ?? []) {
			const id = event.player?.id
			if (id == null || innings.has(id)) continue
			if (SUBSTITUTIONS.has(event.details?.eventType ?? '')) {
				innings.set(id, { inning: play.about.inning, half: play.about.halfInning })
			}
		}
	}
	return innings
}

/** Half-innings in game order: top of the 1st is 2, bottom of the 1st is 3. */
function halfKey({ inning, half }: HalfInning) {
	return inning * 2 + (half === 'bottom' ? 1 : 0)
}

/**
 * Whether this row's player was in the game when their team batted in this
 * inning. A pinch hitter counts from the half-inning they batted in; a
 * defensive replacement who came in while their team was in the field counts
 * from the next time it bats.
 */
export function isInGame(row: ScorecardRow, inning: number, side: 'away' | 'home') {
	const batting = halfKey({ inning, half: side === 'away' ? 'top' : 'bottom' })
	return (
		(!row.entered || halfKey(row.entered) <= batting) &&
		(!row.exited || batting < halfKey(row.exited))
	)
}

const BASES = ['1B', '2B', '3B']

/**
 * One team's scorecard: a row per player in batting order, a cell per plate
 * appearance, and runs, hits, errors and runners left on base per inning.
 */
export function buildScorecard({
	plays = [],
	side,
	lineup,
	scheduledInnings = 9,
	isFinal = false,
}: {
	plays?: MLB.Play[]
	side: 'away' | 'home'
	lineup: LineupEntry[]
	scheduledInnings?: number
	/** Every half-inning is over, even one that ended on a walk-off. */
	isFinal?: boolean
}): Scorecard {
	const half = side === 'away' ? 'top' : 'bottom'
	const entered = entryInnings(plays)

	const rows = new Map<number, ScorecardRow>()
	const emptyTotals = (): BattingTotals => ({ ab: 0, r: 0, h: 0, rbi: 0, bb: 0, k: 0 })

	for (const { playerId, battingOrder } of lineup) {
		const order = Number(battingOrder)
		rows.set(playerId, {
			playerId,
			slot: Math.floor(order / 100),
			order,
			isSubstitute: order % 100 !== 0,
			enteredInning: order % 100 !== 0 ? entered.get(playerId)?.inning : undefined,
			entered: order % 100 !== 0 ? entered.get(playerId) : undefined,
			cells: [],
			totals: emptyTotals(),
		})
	}

	/** Players the lineup didn't know about yet go to the bottom, in the order they came up. */
	function rowFor(playerId: number) {
		let row = rows.get(playerId)
		if (!row) {
			row = {
				playerId,
				slot: 10 + rows.size,
				order: (10 + rows.size) * 100,
				isSubstitute: true,
				enteredInning: entered.get(playerId)?.inning,
				entered: entered.get(playerId),
				cells: [],
				totals: emptyTotals(),
			}
			rows.set(playerId, row)
		}
		return row
	}

	const innings = new Map<number, { columns: number; totals: InningTotals }>()

	let currentInning: number | undefined
	/** Runners on base, by player ID, and the cell that put them there. */
	let onBase = new Map<number, { base: string; cell?: ScorecardCell }>()
	/** How many times each lineup slot has come up this inning. */
	let slotVisits = new Map<number, number>()
	let errors = new Set<string>()

	plays.forEach((play, i) => {
		if (play.about?.halfInning !== half) return

		const inning = play.about.inning
		if (inning !== currentInning) {
			currentInning = inning
			onBase = new Map()
			slotVisits = new Map()
			errors = new Set()
			innings.set(inning, { columns: 1, totals: { runs: 0, hits: 0, errors: 0 } })
		}
		const totals = innings.get(inning)!.totals

		function addCell(playerId: number, cell: Omit<ScorecardCell, 'column' | 'inning'>) {
			const row = rowFor(playerId)
			const column = slotVisits.get(row.slot) ?? 0
			slotVisits.set(row.slot, column + 1)
			const entry = innings.get(inning)!
			entry.columns = Math.max(entry.columns, column + 1)
			const full: ScorecardCell = { ...cell, inning, column }
			row.cells.push(full)
			return full
		}

		// Extra innings start with a runner on second
		for (const event of play.playEvents ?? []) {
			if (event.details?.eventType !== 'runner_placed' || !event.player) continue
			const cell = addCell(event.player.id, {
				label: 'AR',
				kind: 'runner',
				atBatIndex: play.about.atBatIndex,
				playerId: event.player.id,
				rbi: 0,
				scored: false,
				isScoringPlay: false,
				description: event.details.description ?? 'Automatic runner',
			})
			onBase.set(event.player.id, { base: `${event.base ?? 2}B`, cell })
		}

		const batterId = play.matchup?.batter?.id
		let batterCell: ScorecardCell | undefined

		if (batterId != null && isPlateAppearance(play)) {
			const eventType = play.result.eventType
			const rbi = play.result.rbi ?? 0
			batterCell = addCell(batterId, {
				...notation(play),
				atBatIndex: play.about.atBatIndex,
				playerId: batterId,
				rbi,
				scored: false,
				isScoringPlay: !!play.runners?.some((r) => r.movement?.end === 'score'),
				description: play.result.description,
			})

			const row = rowFor(batterId)
			if (!NOT_AT_BATS.has(eventType)) row.totals.ab++
			if (eventType in HITS) {
				row.totals.h++
				totals.hits++
			}
			if (eventType === 'walk' || eventType === 'intent_walk') row.totals.bb++
			if (STRIKEOUTS.has(eventType)) row.totals.k++
			row.totals.rbi += rbi
		}

		// Runners move in order, and the same runner can show up more than once (1B → 2B, 2B → 3B)
		const movers = new Set((play.runners ?? []).map((r) => r.details?.runner?.id))
		for (const runner of play.runners ?? []) {
			const { start, end, isOut, outNumber } = runner.movement ?? {}
			const runnerId = runner.details?.runner?.id
			if (runnerId == null) continue

			let spot = start ? onBase.get(runnerId) : { base: '', cell: batterCell }
			if (!spot && start) {
				// A pinch runner takes over the spot of whoever was on that base
				const replaced = [...onBase].find(([id, s]) => s.base === start && !movers.has(id))
				if (replaced) {
					spot = replaced[1]
					onBase.delete(replaced[0])
				}
			}

			for (const credit of runner.credits ?? []) {
				if (isError(credit.credit)) {
					errors.add(`${play.about.atBatIndex}:${runner.details.playIndex}:${credit.credit}`)
				}
			}

			onBase.delete(runnerId)
			const cell = spot?.cell

			if (isOut) {
				if (cell && outNumber) cell.out = outNumber
			} else if (end === 'score') {
				if (cell) cell.scored = true
				rowFor(runnerId).totals.r++
				totals.runs++
			} else if (end && BASES.includes(end)) {
				onBase.set(runnerId, { base: end, cell })
			}
		}

		totals.errors = errors.size

		const next = plays[i + 1]
		const halfOver = next
			? next.about.inning !== inning || next.about.halfInning !== half
			: isFinal || play.count?.outs === 3
		if (halfOver) totals.lob = onBase.size
	})

	const lastInning = Math.max(scheduledInnings, ...plays.map((p) => p.about?.inning ?? 0))

	return {
		innings: Array.from({ length: lastInning }, (_, i) => {
			const entry = innings.get(i + 1)
			return { inning: i + 1, columns: entry?.columns ?? 1, totals: entry?.totals }
		}),
		rows: withExits([...rows.values()].sort((a, b) => a.order - b.order)),
	}
}

/** Each player leaves when the next player in their lineup spot comes in. */
function withExits(rows: ScorecardRow[]) {
	rows.forEach((row, i) => {
		const next = rows[i + 1]
		if (next?.slot === row.slot) row.exited = next.entered
	})
	return rows
}
