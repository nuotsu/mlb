export type RosterGroup = {
	label: string
	players: MLB.Roster[]
}

/** Position groups by the roster entry's `position.type`, in display order */
const GROUPS: { label: string; types: string[] }[] = [
	{ label: 'Pitchers', types: ['Pitcher'] },
	{ label: 'Catchers', types: ['Catcher'] },
	{ label: 'Infielders', types: ['Infielder'] },
	{ label: 'Outfielders', types: ['Outfielder'] },
	{ label: 'Designated Hitters', types: ['Hitter'] },
	{ label: 'Two-Way', types: ['Two-Way Player'] },
]

function lastFirstName(entry: MLB.Roster) {
	return (entry.person as MLB.Person).lastFirstName ?? entry.person.fullName
}

/**
 * Splits a roster into position groups, sorted by name, leaving out empty
 * groups. A full-season roster can list a player twice (traded away and back),
 * so each player is kept once. Anything with an unknown position type lands
 * in "Other" rather than vanishing.
 */
export function groupRoster(roster: MLB.Roster[]): RosterGroup[] {
	const seen = new Set<number>()
	const unique = roster.filter(({ person }) => !seen.has(person.id) && !!seen.add(person.id))

	const known = new Set(GROUPS.flatMap(({ types }) => types))

	return [
		...GROUPS.map(({ label, types }) => ({
			label,
			players: unique.filter(({ position }) => types.includes(position?.type)),
		})),
		{
			label: 'Other',
			players: unique.filter(({ position }) => !known.has(position?.type)),
		},
	]
		.map((group) => ({
			...group,
			players: group.players.sort((a, b) => lastFirstName(a).localeCompare(lastFirstName(b))),
		}))
		.filter(({ players }) => players.length)
}

/** "L/R" for bats left, throws right; `—` for a side the API doesn't know */
export function batsThrows(person: Partial<MLB.Person>) {
	return `${person.batSide?.code ?? '—'}/${person.pitchHand?.code ?? '—'}`
}

export function headshotUrl(personId: number) {
	return `https://img.mlbstatic.com/mlb-photos/image/upload/w_213,q_auto:best/v1/people/${personId}/headshot/67/current`
}
