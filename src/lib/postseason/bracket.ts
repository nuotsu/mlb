/**
 * Builds a postseason bracket from MLB's series schedule, falling back to a projection from
 * the regular-season standings while the current season is still being played.
 *
 * The bracket is a template of the season's format (how many series per round, which slots
 * are byes) that gets filled in from real series as MLB publishes them, so partially played
 * postseasons render with TBD slots for what hasn't been decided yet.
 */

export type Round = 'F' | 'D' | 'L' | 'W'
export type LeagueSide = 'AL' | 'NL'

export interface BracketTeam {
	id: number
	name: string
	/** Only set on projected teams: `false` while a playoff spot is still up for grabs. */
	clinched?: boolean
}

export interface BracketSlot {
	team?: BracketTeam
	wins: number
	/** The previous-round series that decides this slot; absent for byes and direct entries. */
	feeder?: BracketSeries
	/** Layout height in team rows. */
	height: number
	/** Vertical center in rows, relative to the top of the series. */
	center: number
}

export interface BracketSeries {
	id: string
	round: Round
	league?: LeagueSide
	top: BracketSlot
	bottom: BracketSlot
	gamesToWin: number
	gamesPlayed: number
	live: boolean
	winner?: BracketTeam
	height: number
}

export interface Bracket {
	season: number
	/** League rounds in playing order, before the World Series. */
	rounds: RoundSpec[]
	al?: BracketSeries
	nl?: BracketSeries
	worldSeries: BracketSeries
	/** Seeded from standings rather than MLB's published series. */
	projected: boolean
	live: boolean
	height: number
}

export interface RoundSpec {
	round: Exclude<Round, 'W'>
	/** Series per league. */
	series: number
	gamesToWin: number
}

export interface Format {
	rounds: RoundSpec[]
	worldSeriesGamesToWin: number
}

const ROUND_NAMES: Record<Round, string> = {
	F: 'Wild Card',
	D: 'Division Series',
	L: 'Championship Series',
	W: 'World Series',
}

export function roundName(round: Round, league?: LeagueSide) {
	if (round === 'W') return ROUND_NAMES.W
	if (!league) return ROUND_NAMES[round]
	return round === 'F' ? `${league} Wild Card` : round === 'L' ? `${league}CS` : `${league}DS`
}

/** The playoff structure MLB used in a given season; `null` when there was no postseason. */
export function formatFor(season: number): Format | null {
	if (season < 1903 || season === 1904 || season === 1994) return null

	const worldSeriesGamesToWin = season === 1903 || (season >= 1919 && season <= 1921) ? 5 : 4

	if (season < 1969) return { rounds: [], worldSeriesGamesToWin }

	const lcs: RoundSpec = { round: 'L', series: 1, gamesToWin: season < 1985 ? 3 : 4 }
	if (season < 1995) return { rounds: [lcs], worldSeriesGamesToWin }

	const ds: RoundSpec = { round: 'D', series: 2, gamesToWin: 3 }
	if (season < 2012) return { rounds: [ds, lcs], worldSeriesGamesToWin }

	if (season === 2020)
		return { rounds: [{ round: 'F', series: 4, gamesToWin: 2 }, ds, lcs], worldSeriesGamesToWin }

	if (season < 2022)
		return { rounds: [{ round: 'F', series: 1, gamesToWin: 1 }, ds, lcs], worldSeriesGamesToWin }

	return { rounds: [{ round: 'F', series: 2, gamesToWin: 2 }, ds, lcs], worldSeriesGamesToWin }
}

/**
 * Seeds for the 12-team format, the only one projections are made for, in template order.
 * The first template series of each round feeds the bottom of the next, so the second entry
 * is the one that ends up on top: seed 1 and the 4v5 winner over seed 2 and the 3v6 winner.
 */
const PROJECTED_FIRST_ROUND: [number, number][] = [
	[3, 6],
	[4, 5],
]
const PROJECTED_BYES = [2, 1]

function isProjectableFormat(format: Format) {
	const [first] = format.rounds
	return format.rounds.length === 3 && first?.round === 'F' && first.series === 2
}

function slot(): BracketSlot {
	return { wins: 0, height: 1, center: 0.5 }
}

function createSeries(
	id: string,
	round: Round,
	gamesToWin: number,
	league?: LeagueSide,
): BracketSeries {
	return {
		id,
		round,
		league,
		top: slot(),
		bottom: slot(),
		gamesToWin,
		gamesPlayed: 0,
		live: false,
		height: 2,
	}
}

/**
 * One league's side of the template, round by round, before any series is wired to the
 * next round. Which slot a series feeds is decided while filling, from who actually
 * advanced, and defaults to the template convention otherwise.
 */
function buildLeagueTemplate(rounds: RoundSpec[], league: LeagueSide): BracketSeries[][] {
	return rounds.map((spec) =>
		Array.from({ length: spec.series }, (_, i) =>
			createSeries(`${league}-${spec.round}-${i + 1}`, spec.round, spec.gamesToWin, league),
		),
	)
}

/**
 * Wires the series still unattached in `previous` into the free slots of `templates`, bottom
 * slots first so a bye team always sits on a top line.
 */
function attachRemaining(templates: BracketSeries[], previous: BracketSeries[] = []) {
	const attached = new Set(templates.flatMap((t) => [t.top.feeder, t.bottom.feeder]))
	const free = previous.filter((p) => !attached.has(p))

	for (const t of templates) if (!t.bottom.feeder && free.length) t.bottom.feeder = free.shift()
	for (const t of templates) if (!t.top.feeder && free.length) t.top.feeder = free.shift()
}

/** Row heights and centers, computed once the tree is final. */
function measure(target: BracketSeries) {
	for (const s of [target.top, target.bottom]) {
		if (s.feeder) measure(s.feeder)
		s.height = s.feeder?.height ?? 1
	}
	target.top.center = target.top.height / 2
	target.bottom.center = target.top.height + target.bottom.height / 2
	target.height = target.top.height + target.bottom.height
}

/* -------------------------------------------------------------------------------------------- */

interface RealSeries {
	round: Round
	order: number
	league?: LeagueSide
	games: MLB.Game[]
	teamIds: number[]
	assigned: boolean
}

export interface TeamInfo {
	team: MLB.Team
	league?: LeagueSide
}

function leagueFromDescription(text?: string): LeagueSide | undefined {
	if (!text) return
	if (/\bAL\b|American/.test(text)) return 'AL'
	if (/\bNL\b|National/.test(text)) return 'NL'
}

function parseRealSeries(
	response: MLB.PostseasonSeriesResponse | null | undefined,
	teams: Map<number, TeamInfo>,
): RealSeries[] {
	return (response?.series ?? [])
		.map((entry, index) => {
			const games = [...(entry.games ?? [])].sort(
				(a, b) =>
					(a.seriesGameNumber ?? 0) - (b.seriesGameNumber ?? 0) ||
					a.gameDate.localeCompare(b.gameDate),
			)
			const first = games[0]
			const round = (entry.series?.gameType ?? first?.gameType) as Round
			const teamIds = [
				...new Set(games.flatMap((g) => [g.teams.away.team.id, g.teams.home.team.id])),
			].filter(Boolean)
			const league =
				teamIds.map((id) => teams.get(id)?.league).find(Boolean) ??
				leagueFromDescription(first?.description ?? first?.seriesDescription)
			const order = Number(entry.series?.id?.split('-').at(-1)) || entry.series?.sortNumber || index

			return { round, order, league, games, teamIds, assigned: false }
		})
		.filter((s) => s.games.length > 0 && ['F', 'D', 'L', 'W'].includes(s.round))
		.sort((a, b) => a.order - b.order)
}

function isFinal(game: MLB.Game) {
	return game.status?.abstractGameState === 'Final'
}

function teamFromGame(gameTeam: MLB.GameTeam, teams: Map<number, TeamInfo>): BracketTeam {
	const info = teams.get(gameTeam.team.id)?.team
	return { id: gameTeam.team.id, name: info?.name ?? gameTeam.team.name }
}

/** Series wins for `teamId`, counted from finished games rather than trusting a record field. */
function countWins(games: MLB.Game[], teamId?: number) {
	if (!teamId) return 0
	return games.filter(
		(g) =>
			isFinal(g) &&
			((g.teams.away.team.id === teamId && g.teams.away.isWinner) ||
				(g.teams.home.team.id === teamId && g.teams.home.isWinner)),
	).length
}

/**
 * Copies a real series' teams into a template series and wires in the previous-round series
 * each team came through. A team that advanced sits on the bottom line when the other slot
 * is a bye, matching how MLB draws the bracket.
 */
function placeTeams(
	target: BracketSeries,
	real: RealSeries,
	previousRound: RealSeries[],
	previousTemplates: BracketSeries[],
	siblings: BracketSeries[],
	teams: Map<number, TeamInfo>,
) {
	const first = real.games[0]
	const home = teamFromGame(first.teams.home, teams)
	const away = teamFromGame(first.teams.away, teams)

	const cameThrough = (team: BracketTeam) =>
		previousRound.find((s) => !s.assigned && s.teamIds.includes(team.id))

	// Previous-round series already wired into this round by a sibling processed earlier.
	const attached = new Set(siblings.flatMap((t) => [t.top.feeder, t.bottom.feeder]).filter(Boolean))
	const freeTemplate = () => previousTemplates.find((t) => !attached.has(t))

	const placed = [home, away].map((team) => {
		const through = cameThrough(team)
		const template = through && freeTemplate()
		if (through && template) {
			through.assigned = true
			realOf.set(template, through)
			attached.add(template)
		}
		return { team, feeder: template || undefined }
	})

	// Home team on top, unless only the away team came through and would sit under a bye.
	const [topEntry, bottomEntry] =
		placed[0].feeder && !placed[1].feeder ? [placed[1], placed[0]] : placed

	target.top.team = topEntry.team
	target.top.feeder = topEntry.feeder
	target.bottom.team = bottomEntry.team
	target.bottom.feeder = bottomEntry.feeder
}

/** Real series matched to each template series while filling a bracket. */
const realOf = new WeakMap<BracketSeries, RealSeries>()

function applyResults(target: BracketSeries, real: RealSeries | undefined) {
	const { top, bottom } = target

	top.team ??= top.feeder?.winner
	bottom.team ??= bottom.feeder?.winner

	if (!real) return

	const gamesInSeries = real.games.find((g) => g.gamesInSeries)?.gamesInSeries
	if (gamesInSeries) target.gamesToWin = Math.ceil(gamesInSeries / 2)

	top.wins = countWins(real.games, top.team?.id)
	bottom.wins = countWins(real.games, bottom.team?.id)
	target.gamesPlayed = real.games.filter(isFinal).length
	target.live = real.games.some((g) => g.status?.abstractGameState === 'Live')

	if (top.wins >= target.gamesToWin) target.winner = top.team
	else if (bottom.wins >= target.gamesToWin) target.winner = bottom.team
}

function fillLeague(
	byRound: BracketSeries[][],
	reals: RealSeries[],
	league: LeagueSide,
	teams: Map<number, TeamInfo>,
) {
	const realsByRound = byRound.map((templates) =>
		reals.filter((r) => r.league === league && r.round === templates[0]?.round),
	)

	// Match from the last round backwards so a series' feeders are found by team, then hand
	// out whatever is left in each round by MLB's own ordering.
	for (let r = byRound.length - 1; r >= 0; r--) {
		for (const template of byRound[r]) {
			let real = realOf.get(template)
			if (!real) {
				real = realsByRound[r].find((s) => !s.assigned)
				if (real) {
					real.assigned = true
					realOf.set(template, real)
				}
			}
			if (real)
				placeTeams(
					template,
					real,
					realsByRound[r - 1] ?? [],
					byRound[r - 1] ?? [],
					byRound[r],
					teams,
				)
		}
		attachRemaining(byRound[r], byRound[r - 1])
	}

	// Results flow forwards so winners are known before the next round reads them.
	for (const templates of byRound) {
		for (const template of templates) applyResults(template, realOf.get(template))
	}
}

/* -------------------------------------------------------------------------------------------- */

export interface BuildOptions {
	season: number
	series?: MLB.PostseasonSeriesResponse | null
	teams: Map<number, TeamInfo>
	/** Regular-season standings, used to project the bracket before MLB publishes it. */
	standings?: MLB.StandingsResponse | null
}

export function buildBracket({ season, series, teams, standings }: BuildOptions): Bracket | null {
	const format = formatFor(season)
	if (!format) return null

	const reals = parseRealSeries(series, teams)
	const hasRealData = reals.length > 0

	const alRounds = buildLeagueTemplate(format.rounds, 'AL')
	const nlRounds = buildLeagueTemplate(format.rounds, 'NL')
	const al = alRounds.at(-1)?.[0]
	const nl = nlRounds.at(-1)?.[0]
	const worldSeries = createSeries('W', 'W', format.worldSeriesGamesToWin)
	worldSeries.top.feeder = al
	worldSeries.bottom.feeder = nl

	let projected = false

	if (hasRealData) {
		fillLeague(alRounds, reals, 'AL', teams)
		fillLeague(nlRounds, reals, 'NL', teams)

		const ws = reals.find((r) => r.round === 'W')
		if (ws) {
			const first = ws.games[0]
			const home = teamFromGame(first.teams.home, teams)
			const away = teamFromGame(first.teams.away, teams)
			const homeLeague =
				teams.get(home.id)?.league ?? (al?.winner?.id === home.id ? 'AL' : undefined)
			const [alTeam, nlTeam] = homeLeague === 'NL' ? [away, home] : [home, away]
			worldSeries.top.team = alTeam
			worldSeries.bottom.team = nlTeam
		}
		applyResults(worldSeries, ws)
	} else if (standings && isProjectableFormat(format)) {
		projected = true
		for (const rounds of [alRounds, nlRounds]) {
			rounds.forEach((templates, r) => attachRemaining(templates, rounds[r - 1]))
		}
		seedFromStandings(alRounds, standings, 'AL')
		seedFromStandings(nlRounds, standings, 'NL')
	} else {
		return null
	}

	measure(worldSeries)

	const live = [...flatten(al), ...flatten(nl), worldSeries].some((s) => s.live)

	return {
		season,
		rounds: format.rounds,
		al,
		nl,
		worldSeries,
		projected,
		live,
		height: Math.max(worldSeries.top.height, worldSeries.bottom.height),
	}
}

export function flatten(root?: BracketSeries): BracketSeries[] {
	if (!root) return []
	return [root, ...flatten(root.top.feeder), ...flatten(root.bottom.feeder)]
}

/* -------------------------------------------------------------------------------------------- */

const LEAGUE_IDS: Record<number, LeagueSide> = { 103: 'AL', 104: 'NL' }

export function leagueSide(leagueId?: number): LeagueSide | undefined {
	return leagueId ? LEAGUE_IDS[leagueId] : undefined
}

/**
 * Seeds one league from the standings: division leaders by record take seeds 1-3, then the
 * wild card order. The template's first round is the 4v5 and 3v6 series, whose winners meet
 * the top two seeds in the Division Series.
 */
function seedFromStandings(
	byRound: BracketSeries[][],
	standings: MLB.StandingsResponse,
	league: LeagueSide,
) {
	const records = standings.records
		.filter((r) => leagueSide(r.league?.id) === league)
		.flatMap((r) => r.teamRecords)

	const byRecord = (a: MLB.TeamRecord, b: MLB.TeamRecord) =>
		Number(b.winningPercentage) - Number(a.winningPercentage) || b.wins - a.wins

	const leaders = records.filter((r) => r.divisionLeader).sort(byRecord)
	const wildCards = records
		.filter((r) => !r.divisionLeader)
		.sort(
			(a, b) =>
				(Number(a.wildCardRank) || Infinity) - (Number(b.wildCardRank) || Infinity) ||
				byRecord(a, b),
		)

	const seeds = [...leaders, ...wildCards].slice(0, 6)
	const seed = (n: number): BracketTeam | undefined => {
		const record = seeds[n - 1]
		if (!record) return
		return { id: record.team.id, name: record.team.name, clinched: !!record.clinched }
	}

	const [firstRound, divisionSeries] = byRound

	PROJECTED_FIRST_ROUND.forEach(([high, low], i) => {
		const s = firstRound?.[i]
		if (!s) return
		s.top.team = seed(high)
		s.bottom.team = seed(low)
	})

	PROJECTED_BYES.forEach((n, i) => {
		const s = divisionSeries?.[i]
		if (!s) return
		s.top.team = seed(n)
	})
}
