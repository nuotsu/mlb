import type { UmpireCalls } from '#lib/umpires.js'

export interface UmpireLayoutProps {
	/** Full crew, home plate first. */
	crew: MLB.Official[]
	/** Home plate umpire's call grades, if any pitches have been called. */
	calls: UmpireCalls | null
	teams: { home: MLB.Team; away: MLB.Team }
	/** UmpScorecards page for the game. */
	href: string
}

/** Which team the missed calls helped, and by how much: runs from UmpScorecards, else net calls. */
export function favorOf(calls: UmpireCalls, teams: UmpireLayoutProps['teams']) {
	const [value, unit] =
		calls.favorHome != null
			? [calls.favorHome, 'runs']
			: [calls.favored.home - calls.favored.away, 'calls']

	if (!value) return null

	return {
		team: value > 0 ? teams.home : teams.away,
		value: Math.abs(value),
		unit,
		label: unit === 'runs' ? Math.abs(value).toFixed(2) : String(Math.abs(value)),
	}
}

export const SOURCE_LABEL = {
	umpscorecards: 'via UmpScorecards',
	tracking: 'from pitch tracking',
} as const
