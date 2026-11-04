import { fetchMLB } from '#lib/fetch/index.js'

export type Division = { name: string; teams: MLB.Team[] }

type TeamWithDivision = MLB.Team & { division?: MLB.Division }

let teams = $state<MLB.Team[]>()
let request: Promise<void> | undefined

/** MLB teams, fetched once in the browser on first read; `undefined` until loaded */
export function mlbTeams() {
	request ??= fetchMLB<MLB.TeamsResponse>('/api/v1/teams', {
		sportId: '1',
		fields: ['teams,id,name,teamName,abbreviation', 'division,nameShort,sortOrder'],
		hydrate: 'division',
	})
		.then((data) => {
			teams = data.teams.toSorted((a, b) => a.name.localeCompare(b.name))
		})
		.catch(() => {
			teams = []
		})

	return teams
}

/** Teams grouped by division, in the league's division order */
export function byDivision(teams: MLB.Team[]): Division[] {
	const divisions = new Map<string, { sortOrder: number; teams: MLB.Team[] }>()

	for (const team of teams as TeamWithDivision[]) {
		const name = team.division?.nameShort ?? 'Other'
		const entry = divisions.get(name) ?? { sortOrder: team.division?.sortOrder ?? 999, teams: [] }
		entry.teams.push(team)
		divisions.set(name, entry)
	}

	return [...divisions]
		.toSorted(([, a], [, b]) => a.sortOrder - b.sortOrder)
		.map(([name, { teams }]) => ({ name, teams }))
}
