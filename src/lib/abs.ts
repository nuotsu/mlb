/**
 * ABS (Automated Ball-Strike) and replay challenges, as the live feed records
 * them: a pitch's `reviewDetails`, or, for a challenge on the pitch that ended
 * the plate appearance, often only a sentence in `result.description`.
 */

/** MLB feed codes: MJ = player ABS challenge; MA/MI/etc. = traditional play reviews */
export function isAbsReview(details?: MLB.ReviewDetails): details is MLB.ReviewDetails {
	return details?.reviewType?.toUpperCase() === 'MJ'
}

/** Ending-PA / play-result challenges often live only in result.description, not reviewDetails. */
export const DESCRIPTION_CHALLENGE =
	/(?:^|(?<=: ))(.+?) challenged \(([^)]+)\), call on the field was (confirmed|overturned|upheld)/gi

export type DescriptionChallenge = {
	/** A player's full name, or a team's for a play review */
	challenger: string
	/** What was challenged, like `pitch result` or `tag play` */
	challengeOf: string
	isAbs: boolean
	isOverturned: boolean
}

/** Every challenge a play's description mentions, in order. */
export function descriptionChallenges(description?: string): DescriptionChallenge[] {
	return [...(description ?? '').matchAll(DESCRIPTION_CHALLENGE)].map(
		([, challenger, challengeOf, result]) => ({
			challenger,
			challengeOf,
			isAbs: /pitch result/i.test(challengeOf),
			isOverturned: result.toLowerCase() === 'overturned',
		}),
	)
}
