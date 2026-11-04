import { fetchMLB } from '#lib/fetch/index.js'

let teams = $state<MLB.Team[]>()
let request: Promise<void> | undefined

/** MLB teams sorted by name, fetched once in the browser on first read; `undefined` until loaded */
export function mlbTeams() {
	request ??= fetchMLB<MLB.TeamsResponse>('/api/v1/teams', {
		sportId: '1',
		fields: ['teams,id,name,teamName,abbreviation'],
	})
		.then((data) => {
			teams = data.teams.toSorted((a, b) => a.name.localeCompare(b.name))
		})
		.catch(() => {
			teams = []
		})

	return teams
}
