import { daysBetween } from '#lib/temporal.js'

export type GameState = 'final' | 'live' | 'preview' | 'postponed' | 'cancelled' | 'suspended'

/** One game from the team's side: who they played, where, and how it went */
export type TeamGame = {
	gamePk: number
	/** The calendar day the schedule lists the game under (YYYY-MM-DD) */
	date: string
	/** Scheduled first pitch, ISO in UTC */
	gameDate: string
	gameType: string
	description?: string
	isHome: boolean
	opponent: MLB.Team
	state: GameState
	startTimeTBD: boolean
	teamScore: number | null
	opponentScore: number | null
	/** `null` until the game is final, and for ties */
	didWin: boolean | null
	/** The team's starter: announced, or predicted from the rotation */
	pitcher: MLB.Person | null
	predicted: boolean
}

export type TeamSeries = {
	opponent: MLB.Team
	isHome: boolean
	gameType: string
	startDate: string
	endDate: string
	games: TeamGame[]
	wins: number
	losses: number
}

export function gameState(status: Partial<MLB.GameStatus> | undefined): GameState {
	const detailed = status?.detailedState ?? ''

	if (detailed === 'Postponed') return 'postponed'
	if (detailed === 'Cancelled' || detailed === 'Canceled') return 'cancelled'
	if (detailed.startsWith('Suspended')) return 'suspended'
	if (status?.abstractGameState === 'Final') return 'final'
	if (status?.abstractGameState === 'Live') return 'live'
	return 'preview'
}

/** Flattens a schedule into the team's games, oldest first. */
export function toTeamGames(
	schedule: Pick<MLB.ScheduleResponse, 'dates'> | undefined,
	teamId: number,
): TeamGame[] {
	return (schedule?.dates ?? [])
		.flatMap(({ date, games }) =>
			(games ?? []).map((game): TeamGame => {
				const isHome = game.teams.home.team.id === teamId
				const side = isHome ? game.teams.home : game.teams.away
				const other = isHome ? game.teams.away : game.teams.home
				const state = gameState(game.status)
				const hasScore = (state === 'final' || state === 'live') && side.score != null

				return {
					gamePk: game.gamePk,
					date,
					gameDate: game.gameDate,
					gameType: game.gameType,
					description: game.description,
					isHome,
					opponent: other.team,
					state,
					startTimeTBD: !!game.status.startTimeTBD,
					teamScore: hasScore ? (side.score ?? null) : null,
					opponentScore: hasScore ? (other.score ?? null) : null,
					didWin: state === 'final' && side.isWinner != null ? side.isWinner : null,
					pitcher: side.probablePitcher ?? null,
					predicted: false,
				}
			}),
		)
		.sort((a, b) => a.date.localeCompare(b.date) || a.gameDate.localeCompare(b.gameDate))
}

/**
 * Groups consecutive games against the same opponent into series. The API's
 * `seriesGameNumber` restarts around postponements and makeups, so it isn't
 * trusted: a regular-season series is a run of games against one opponent in
 * one ballpark on back-to-back days. A postseason series keeps going across
 * travel days and the switch between ballparks.
 */
export function groupSeries(games: TeamGame[]): TeamSeries[] {
	const series: TeamSeries[] = []
	let current: TeamSeries | undefined

	for (const game of games) {
		const last = current?.games.at(-1)
		const continues =
			current &&
			last &&
			current.opponent.id === game.opponent.id &&
			current.gameType === game.gameType &&
			(game.gameType !== 'R' ||
				(current.isHome === game.isHome && daysBetween(last.date, game.date) <= 1))

		if (!continues) {
			current = {
				opponent: game.opponent,
				isHome: game.isHome,
				gameType: game.gameType,
				startDate: game.date,
				endDate: game.date,
				games: [],
				wins: 0,
				losses: 0,
			}
			series.push(current)
		}

		current!.games.push(game)
		current!.endDate = game.date
		if (game.didWin === true) current!.wins++
		if (game.didWin === false) current!.losses++
	}

	return series
}

/**
 * The rotation from recent starts, ordered by when each pitcher last started.
 * Scanning backwards keeps the latest starter at the end of the list, so
 * predictions always have a slot to continue from — a spot start or bullpen
 * game earlier in the window would otherwise truncate the rotation before the
 * latest starter and drop every prediction.
 */
export function extractRotation(pitchers: MLB.Person[]): MLB.Person[] {
	const rotation: MLB.Person[] = []
	const seen = new Set<number>()
	for (let i = pitchers.length - 1; i >= 0; i--) {
		const p = pitchers[i]
		if (seen.has(p.id)) break
		seen.add(p.id)
		rotation.unshift(p)
	}
	if (rotation.length >= 2) return rotation

	// Back-to-back starts by the same pitcher leave no cycle to walk —
	// fall back to every distinct starter in the window, oldest first
	return pitchers.filter((p, i) => pitchers.findIndex((q) => q.id === p.id) === i)
}

/** Recent starts the rotation is read from; covers a six-man rotation with gaps */
const ROTATION_WINDOW = 10

/**
 * Fills in a predicted starter for upcoming games nobody has been announced
 * for, by walking the rotation on from the last start. An announced starter
 * re-syncs the walk to their slot, so later predictions continue from there.
 */
export function predictStarters(games: TeamGame[]): TeamGame[] {
	const recent = games
		.filter((g) => g.state === 'final')
		.slice(-ROTATION_WINDOW)
		.map((g) => g.pitcher)
		.filter((p): p is MLB.Person => !!p)

	const rotation = extractRotation(recent)
	const lastStarter = recent.at(-1)
	let slot =
		lastStarter && rotation.length >= 2 ? rotation.findIndex((p) => p.id === lastStarter.id) : -1

	if (slot === -1) return games

	return games.map((game) => {
		if (game.state !== 'preview') return game

		if (game.pitcher) {
			const announced = rotation.findIndex((p) => p.id === game.pitcher!.id)
			if (announced !== -1) slot = announced
			return game
		}

		slot = (slot + 1) % rotation.length
		return { ...game, pitcher: rotation[slot], predicted: true }
	})
}

/** `YYYY-MM` for each month from the first game through the last */
export function seasonMonths(games: TeamGame[]): string[] {
	const first = games[0]?.date
	const last = games.at(-1)?.date
	if (!first || !last) return []

	const months: string[] = []
	let [y, m] = first.split('-').map(Number)
	const end = last.slice(0, 7)

	for (;;) {
		const month = `${y}-${String(m).padStart(2, '0')}`
		months.push(month)
		if (month >= end) break
		if (++m > 12) [y, m] = [y + 1, 1]
	}

	return months
}

/**
 * The month (`YYYY-MM`) as Monday-first weeks of YYYY-MM-DD dates, with
 * `null` for days that belong to the neighboring months.
 */
export function monthWeeks(month: string): (string | null)[][] {
	const [y, m] = month.split('-').map(Number)
	const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7
	const daysInMonth = new Date(y, m, 0).getDate()

	const days: (string | null)[] = [
		...Array(offset).fill(null),
		...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
	]
	while (days.length % 7) days.push(null)

	return Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7))
}

export type SeriesSegment = {
	series: TeamSeries
	/** 1-based grid column the band starts at */
	column: number
	span: number
	/** The series carries on past this week's edge, so that end stays open */
	continuesBefore: boolean
	continuesAfter: boolean
}

/** The part of each series that falls in `week`, as a band across its columns. */
export function weekSegments(week: (string | null)[], series: TeamSeries[]): SeriesSegment[] {
	return series.flatMap((s) => {
		const columns = week.flatMap((date, i) =>
			date && date >= s.startDate && date <= s.endDate ? [i] : [],
		)
		if (!columns.length) return []

		const first = columns[0]
		const last = columns.at(-1)!

		return {
			series: s,
			column: first + 1,
			span: last - first + 1,
			continuesBefore: week[first] !== s.startDate,
			continuesAfter: week[last] !== s.endDate,
		}
	})
}
