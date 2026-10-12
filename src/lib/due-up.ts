/**
 * The three batters due up for the team at bat: next up, on deck, in the hole.
 *
 * The linescore's `offense.batter` is whoever is at the plate while a plate appearance is
 * under way, and only becomes the next batter once it ends (or between innings). So while
 * `atBat` is still up, the list starts from on deck and the third comes from the batting
 * order, after the batter in the hole.
 */
export function dueUp(
	offense: MLB.Offense | undefined,
	{ atBat, battingOrder }: { atBat?: number; battingOrder?: number[] } = {},
): (MLB.Person | undefined)[] {
	const { batter, onDeck, inHole } = offense ?? {}
	if (atBat == null || batter?.id !== atBat) return [batter, onDeck, inHole]

	const slot = inHole?.id != null ? (battingOrder?.indexOf(inHole.id) ?? -1) : -1
	const after = slot >= 0 ? battingOrder![(slot + 1) % battingOrder!.length] : undefined

	return [onDeck, inHole, after != null ? ({ id: after } as MLB.Person) : undefined]
}
