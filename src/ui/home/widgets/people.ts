import { fetchMLB } from '#lib/fetch/index.js'

export type HomePerson = Pick<MLB.Person, 'id' | 'fullName'> & {
	primaryPosition?: { abbreviation: string }
	currentTeam?: Pick<MLB.Team, 'id' | 'name'>
}

const cache = new Map<string, Promise<HomePerson[]>>()

/** Names, positions, and teams for a list of players, in the order given (memoized per list) */
export function fetchPeople(ids: number[]): Promise<HomePerson[]> {
	const key = ids.join(',')
	let request = cache.get(key)
	if (!request) {
		request = fetchMLB<{ people?: HomePerson[] }>('/api/v1/people', {
			personIds: key,
			fields: ['people,id,fullName,primaryPosition,abbreviation,currentTeam,name'],
			hydrate: 'currentTeam',
		})
			.then(({ people = [] }) => {
				const byId = new Map(people.map((p) => [p.id, p]))
				return ids.flatMap((id) => byId.get(id) ?? [])
			})
			.catch((error) => {
				cache.delete(key)
				throw error
			})
		cache.set(key, request)
	}
	return request
}
