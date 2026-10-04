/** Feed `officialType` → short position label, in the order a crew is listed. */
export const UMPIRE_POSITIONS: Record<string, string> = {
	'Home Plate': 'HP',
	'First Base': '1B',
	'Second Base': '2B',
	'Third Base': '3B',
	'Left Field': 'LF',
	'Right Field': 'RF',
}

export function sortOfficials(officials: MLB.Official[] = []) {
	const order = Object.keys(UMPIRE_POSITIONS)
	const rank = (type: string) => (order.includes(type) ? order.indexOf(type) : order.length)
	return [...officials].sort((a, b) => rank(a.officialType) - rank(b.officialType))
}

/** Game-level numbers from UmpScorecards. Accuracies are fractions (0–1). */
export interface UmpScorecard {
	gamePk?: number
	umpire?: string
	called: number
	correct: number
	incorrect: number
	accuracy: number
	expectedAccuracy?: number
	aboveExpected?: number
	expectedIncorrect?: number
	consistency?: number
	/** Net runs the missed calls gave the home team. */
	favorHome?: number
	totalRunImpact?: number
}

/** Season-to-date line for an umpire from UmpScorecards. */
export interface UmpSeason {
	games?: number
	accuracy?: number
	aboveExpected?: number
	consistency?: number
}

export interface UmpScorecardResponse {
	game: UmpScorecard | null
	season: UmpSeason | null
}

export interface MissedCall {
	/** Horizontal plate location (ft, catcher's view). */
	pX: number
	/** Height normalized to the batter's zone: 0 = bottom, 1 = top. */
	zone: number
	/** The (wrong) call the umpire made. */
	call: 'strike' | 'ball'
	/** Team that benefited from the miss. */
	favored: 'home' | 'away'
	/** Distance from the zone edge, in inches. */
	inches: number
	inning: string
	count?: string
}

export interface TrackedCalls {
	called: number
	correct: number
	incorrect: number
	accuracy: number
	/** Balls called on pitches in the zone. */
	missedStrikes: number
	/** Strikes called on pitches out of the zone. */
	badStrikes: number
	/** Missed calls that went each team's way. */
	favored: { home: number; away: number }
	misses: MissedCall[]
	abs: { challenges: number; overturned: number }
}

/** Half the plate (8.5in) and a baseball's radius (~1.45in), in feet. */
const HALF_PLATE = 8.5 / 12
const BALL_RADIUS = 1.45 / 12

const CALLED_STRIKE = new Set(['C'])
const CALLED_BALL = new Set(['B', '*B'])

/**
 * Grade every called pitch against the rulebook zone using pitch tracking. A
 * pitch is a strike when any part of the ball touches the zone, which is how
 * UmpScorecards and Statcast draw it too — but without their margin-of-error
 * buffer, so this reads a touch harsher than an official scorecard.
 */
export function trackCalls(feedLive: MLB.LiveGameFeed): TrackedCalls {
	const result: TrackedCalls = {
		called: 0,
		correct: 0,
		incorrect: 0,
		accuracy: 0,
		missedStrikes: 0,
		badStrikes: 0,
		favored: { home: 0, away: 0 },
		misses: [],
		abs: { challenges: 0, overturned: 0 },
	}

	for (const play of feedLive.liveData.plays.allPlays ?? []) {
		const battingSide = play.about.isTopInning ? 'away' : 'home'
		const pitchingSide = play.about.isTopInning ? 'home' : 'away'
		const inning = `${play.about.isTopInning ? 'Top' : 'Bot'} ${play.about.inning}`

		for (const event of play.playEvents ?? []) {
			if (event.reviewDetails?.reviewType?.toUpperCase() === 'MJ') {
				result.abs.challenges++
				if (event.reviewDetails.isOverturned) result.abs.overturned++
			}

			const code = event.details?.call?.code ?? event.details?.code ?? ''
			const isStrike = CALLED_STRIKE.has(code)
			if (!event.isPitch || (!isStrike && !CALLED_BALL.has(code))) continue

			const { pX, pZ } = event.pitchData?.coordinates ?? {}
			const { strikeZoneTop: top, strikeZoneBottom: bottom } = event.pitchData ?? {}
			if (pX == null || pZ == null || top == null || bottom == null || top <= bottom) continue

			// Positive = outside the zone, negative = inside, in feet from the nearest edge
			const outside = Math.max(
				Math.abs(pX) - (HALF_PLATE + BALL_RADIUS),
				bottom - BALL_RADIUS - pZ,
				pZ - (top + BALL_RADIUS),
			)
			const inZone = outside <= 0

			result.called++

			if (isStrike === inZone) {
				result.correct++
				continue
			}

			result.incorrect++
			if (isStrike) result.badStrikes++
			else result.missedStrikes++

			const favored = isStrike ? pitchingSide : battingSide
			result.favored[favored]++

			const { balls, strikes } = event.count ?? {}
			result.misses.push({
				pX,
				zone: (pZ - bottom) / (top - bottom),
				call: isStrike ? 'strike' : 'ball',
				favored,
				inches: Math.abs(outside) * 12,
				inning,
				// The event's count already includes this pitch, so back it out
				count:
					balls != null && strikes != null
						? `${Math.max(0, isStrike ? balls : balls - 1)}-${Math.max(0, isStrike ? strikes - 1 : strikes)}`
						: undefined,
			})
		}
	}

	result.accuracy = result.called ? result.correct / result.called : 0
	return result
}

/** Format a 0–1 fraction as a percentage. */
export function percent(value?: number, digits = 1) {
	if (value == null || !Number.isFinite(value)) return '—'
	return `${(value * 100).toFixed(digits)}%`
}

/** Format a signed number with an explicit sign and a real minus. */
export function signed(value?: number, digits = 2) {
	if (value == null || !Number.isFinite(value)) return '—'
	const fixed = Math.abs(value).toFixed(digits)
	if (Number(fixed) === 0) return fixed
	return `${value > 0 ? '+' : '−'}${fixed}`
}

/** Pitch-tracking grades, upgraded with UmpScorecards' official numbers once they post. */
export interface UmpireCalls extends TrackedCalls {
	source: 'umpscorecards' | 'tracking'
	expectedAccuracy?: number
	aboveExpected?: number
	consistency?: number
	favorHome?: number
	totalRunImpact?: number
	season?: UmpSeason | null
}

export function mergeCalls(
	tracked: TrackedCalls,
	scorecard?: UmpScorecardResponse | null,
): UmpireCalls {
	const game = scorecard?.game
	if (!game) return { ...tracked, source: 'tracking', season: scorecard?.season }

	return {
		...tracked,
		...game,
		source: 'umpscorecards',
		season: scorecard.season,
	}
}
