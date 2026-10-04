import type { UmpScorecard, UmpScorecardResponse, UmpSeason } from '#lib/umpires.js'

const UMPSCORECARDS_HOST = 'https://umpscorecards.com'
const TIMEOUT_MS = 8_000

type Row = Record<string, unknown>

/**
 * UmpScorecards' API isn't documented and has renamed columns before, so every
 * field is read from a list of known spellings rather than a fixed schema.
 */
function num(row: Row, ...keys: string[]) {
	for (const key of keys) {
		const value = row[key]
		if (value == null || value === '') continue
		const n = Number(value)
		if (Number.isFinite(n)) return n
	}
}

/** Accuracies come back as either 94.2 or 0.942 — normalize to a fraction. */
function fraction(value?: number) {
	if (value == null) return undefined
	return Math.abs(value) > 1 ? value / 100 : value
}

function str(row: Row, ...keys: string[]) {
	for (const key of keys) {
		if (typeof row[key] === 'string' && row[key]) return row[key] as string
	}
}

function rowsOf(json: unknown): Row[] {
	if (Array.isArray(json)) return json
	if (json && typeof json === 'object') {
		for (const key of ['rows', 'data', 'games', 'umpires', 'results']) {
			const value = (json as Row)[key]
			if (Array.isArray(value)) return value
		}
	}
	return []
}

const normalizeName = (name = '') =>
	name
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z]/gi, '')
		.toLowerCase()

async function fetchRows(endpoint: string, params: Record<string, string>, _fetch = fetch) {
	const url = new URL(endpoint, UMPSCORECARDS_HOST)
	for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)

	const response = await _fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
	if (!response.ok) throw new Error(`UmpScorecards ${response.status}: ${url.pathname}`)

	return rowsOf(await response.json())
}

function toScorecard(row: Row): UmpScorecard | null {
	let called = num(row, 'called_pitches', 'pitches_called', 'total_called', 'pitches')
	let correct = num(row, 'called_correct', 'correct_calls', 'correct')
	let incorrect = num(row, 'called_wrong', 'incorrect_calls', 'incorrect', 'missed_calls')

	if (called == null && correct != null && incorrect != null) called = correct + incorrect
	if (correct == null && called != null && incorrect != null) correct = called - incorrect
	if (incorrect == null && called != null && correct != null) incorrect = called - correct
	if (!called || correct == null || incorrect == null) return null

	const accuracy = fraction(num(row, 'overall_accuracy', 'accuracy')) ?? correct / called
	const expectedAccuracy = fraction(
		num(row, 'expected_accuracy', 'x_overall_accuracy', 'expected_overall_accuracy', 'x_accuracy'),
	)

	return {
		gamePk: num(row, 'game_pk', 'gamePk', 'game_id', 'id'),
		umpire: str(row, 'umpire', 'umpire_name', 'name'),
		called,
		correct,
		incorrect,
		accuracy,
		expectedAccuracy,
		aboveExpected:
			fraction(
				num(row, 'accuracy_above_expected', 'accuracy_above_x', 'overall_accuracy_above_expected'),
			) ?? (expectedAccuracy != null ? accuracy - expectedAccuracy : undefined),
		expectedIncorrect: num(
			row,
			'expected_incorrect_calls',
			'x_incorrect_calls',
			'expected_called_wrong',
			'x_called_wrong',
		),
		consistency: fraction(num(row, 'consistency')),
		favorHome: num(row, 'favor_home', 'home_favor', 'favor'),
		totalRunImpact: num(row, 'total_run_impact', 'run_impact'),
	}
}

function toSeason(row: Row): UmpSeason {
	return {
		games: num(row, 'n', 'games', 'games_umpired', 'count'),
		accuracy: fraction(num(row, 'overall_accuracy', 'accuracy')),
		aboveExpected: fraction(
			num(row, 'accuracy_above_expected', 'accuracy_above_x', 'overall_accuracy_above_expected'),
		),
		consistency: fraction(num(row, 'consistency')),
	}
}

/**
 * The home plate umpire's scorecard for one game, plus their season to date.
 * UmpScorecards publishes the morning after a game, so `game` is often null
 * for anything that ended recently.
 */
export async function fetchUmpScorecard(
	{ gamePk, date, umpire }: { gamePk: number; date: string; umpire?: string },
	{ fetch: _fetch = fetch }: { fetch?: typeof fetch } = {},
): Promise<UmpScorecardResponse> {
	const name = normalizeName(umpire)
	const matchesUmpire = (row: Row) =>
		!!name && normalizeName(str(row, 'umpire', 'umpire_name', 'name')) === name

	const [games, umpires] = await Promise.allSettled([
		fetchRows('/api/games', { startDate: date, endDate: date }, _fetch),
		name
			? fetchRows('/api/umpires', { startDate: `${date.slice(0, 4)}-01-01`, endDate: date }, _fetch)
			: Promise.resolve([]),
	])

	const gameRows = games.status === 'fulfilled' ? games.value : []
	const gameRow =
		gameRows.find((row) => num(row, 'game_pk', 'gamePk', 'game_id', 'id') === gamePk) ??
		gameRows.find(matchesUmpire)

	const seasonRow = umpires.status === 'fulfilled' ? umpires.value.find(matchesUmpire) : undefined

	if (games.status === 'rejected') console.error('[umpScorecard] games', games.reason)
	if (umpires.status === 'rejected') console.error('[umpScorecard] umpires', umpires.reason)

	return {
		game: gameRow ? toScorecard(gameRow) : null,
		season: seasonRow ? toSeason(seasonRow) : null,
	}
}
