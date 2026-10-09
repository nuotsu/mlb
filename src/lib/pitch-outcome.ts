/** A pitch's result as a short label for the pitch list, and in full for screen readers. */
export type PitchOutcome = {
	label: string
	/** Spelled out, for `title` and screen readers. */
	title: string
	/** Backwards, like a called third strike on a scorecard. */
	mirrored?: boolean
	/** Struck through: the swing missed but the ball got away, or the bunt missed. */
	struck?: boolean
}

/**
 * Stats API pitch codes (`/api/v1/pitchCodes`) that a pitch list can show.
 * In-play codes (`X`, `D`, `E`) are handled on their own since they depend
 * on how the play turned out.
 */
const OUTCOMES: Record<string, PitchOutcome> = {
	C: { label: 'K', title: 'Called strike', mirrored: true },
	S: { label: 'K', title: 'Swinging strike' },
	W: { label: 'K', title: 'Swinging strike, blocked', struck: true },
	F: { label: 'Foul', title: 'Foul' },
	T: { label: 'Tip', title: 'Foul tip' },
	L: { label: 'Bunt', title: 'Foul bunt' },
	M: { label: 'Bunt', title: 'Missed bunt', struck: true },
	B: { label: 'Ball', title: 'Ball' },
	'*B': { label: 'Dirt', title: 'Ball in dirt' },
	H: { label: 'HBP', title: 'Hit by pitch' },
	I: { label: 'IBB', title: 'Intentional ball' },
	V: { label: 'IBB', title: 'Automatic ball' },
	P: { label: 'Out', title: 'Pitchout' },
}

const IN_PLAY = new Set(['X', 'D', 'E'])

/** For feeds that leave out `code`: the call or description, lowercased. */
const BY_DESCRIPTION: Record<string, string> = {
	'called strike': 'C',
	'strike - called': 'C',
	'swinging strike': 'S',
	'strike - swinging': 'S',
	'swinging strike (blocked)': 'W',
	'strike - swinging (blocked)': 'W',
	foul: 'F',
	'strike - foul': 'F',
	'foul tip': 'T',
	'strike - foul tip': 'T',
	'foul bunt': 'L',
	'strike - foul bunt': 'L',
	'missed bunt': 'M',
	'strike - missed bunt': 'M',
	ball: 'B',
	'ball in dirt': '*B',
	'ball - in dirt': '*B',
	'hit by pitch': 'H',
	'intent ball': 'I',
	'intentional ball': 'I',
	'automatic ball': 'V',
	pitchout: 'P',
	'in play, out(s)': 'X',
	'in play, no out': 'D',
	'in play, run(s)': 'E',
}

function pitchCode(details?: MLB.PitchDetails) {
	if (details?.code) return details.code
	if (details?.call?.code) return details.call.code
	const description = (details?.call?.description ?? details?.description)?.toLowerCase()
	return description ? BY_DESCRIPTION[description] : undefined
}

/**
 * What a pitch did, or `null` when its code isn't one we label. Only the at-bat's
 * final pitch can be put in play; it reads `HR`, `Run` when anyone scored on it,
 * or `Play`.
 */
export function pitchOutcome(
	play: MLB.Play | undefined,
	pitch: MLB.PlayEvent,
): PitchOutcome | null {
	const code = pitchCode(pitch.details)
	if (!code) return null

	if (IN_PLAY.has(code)) {
		const pitches = play?.playEvents?.filter((e) => e.isPitch) ?? []
		if (pitches.at(-1) !== pitch) return null

		if (play?.result?.eventType === 'home_run') return { label: 'HR', title: 'Home run' }

		const scored =
			code === 'E' ||
			(play?.result?.rbi ?? 0) > 0 ||
			Boolean(
				play?.runners?.some(
					(r) => r.details?.isScoringEvent && r.details.playIndex === pitch.index,
				),
			)
		if (scored) return { label: 'Run', title: 'In play, run(s)' }

		return { label: 'Play', title: code === 'D' ? 'In play, no out' : 'In play, out(s)' }
	}

	return OUTCOMES[code] ?? null
}
