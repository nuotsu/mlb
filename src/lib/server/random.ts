import { fetchMLB } from '#lib/fetch/index.js'
import { shuffle } from '#lib/utils.js'

const PLAYER_ID_MIN = 400000
const PLAYER_ID_MAX = 800000
const GAME_ID_MIN = 600000
const GAME_ID_MAX = 950000

function randomInt(min: number, max: number) {
	return Math.floor(Math.random() * (max - min + 1)) + min
}

async function getRandomTeams(count: number): Promise<App.RandomEntity[]> {
	const res = await fetchMLB<MLB.TeamsResponse>('/api/v1/teams', {
		sportIds: '1,11,12,13,14,22,51',
		fields: ['teams,id,name,franchiseName,locationName,active,abbreviation'],
	})
	const active = (res.teams ?? []).filter((t) => t.active)
	return shuffle(active)
		.slice(0, count)
		.map((t) => ({ type: 'team' as const, ...t, abbreviation: t.abbreviation ?? t.name }))
}

async function getRandomPlayers(count: number): Promise<App.RandomEntity[]> {
	const candidateCount = count * 6
	const ids = Array.from({ length: candidateCount }, () => randomInt(PLAYER_ID_MIN, PLAYER_ID_MAX))

	const results = await Promise.allSettled(
		ids.map((id) =>
			fetchMLB<MLB.PersonResponse>(`/api/v1/people/${id}`, {
				fields: ['people,id,fullName,active,primaryPosition,currentTeam,name'],
			}),
		),
	)

	const valid: App.RandomEntity[] = []
	for (const result of results) {
		if (valid.length >= count) break
		if (result.status === 'fulfilled') {
			const person = result.value.people?.[0]
			if (person?.fullName) {
				valid.push({ type: 'player' as const, ...person })
			}
		}
	}
	return valid
}

async function getRandomGames(count: number): Promise<App.RandomEntity[]> {
	const candidateCount = count * 6
	const ids = Array.from({ length: candidateCount }, () => randomInt(GAME_ID_MIN, GAME_ID_MAX))

	const results = await Promise.allSettled(
		ids.map((id) =>
			fetchMLB<MLB.ScheduleResponse>(`/api/v1/schedule`, {
				gamePk: String(id),
				fields: [
					'dates,games,gamePk,gameDate',
					'flags,noHitter,perfectGame',
					'status,abstractGameState,detailedState,reason',
					'teams,away,home,team,id,name,leagueRecord,wins,losses,score',
				],
				hydrate: 'flags',
			}),
		),
	)

	const valid: App.RandomEntity[] = []
	for (const result of results) {
		if (valid.length >= count) break
		if (result.status === 'fulfilled') {
			const game = result.value.dates?.[0]?.games?.[0]
			if (game?.gamePk) {
				valid.push({ type: 'game' as const, ...game })
			}
		}
	}
	return valid
}

export async function generateBatch(
	count: number,
	types: ('team' | 'player' | 'game')[],
): Promise<App.RandomEntity[]> {
	const perType = Math.ceil(count / types.length)

	const fetchers: Promise<App.RandomEntity[]>[] = types.map((type) => {
		if (type === 'team') return getRandomTeams(perType)
		if (type === 'player') return getRandomPlayers(perType)
		return getRandomGames(perType)
	})

	const results = await Promise.all(fetchers)
	const combined = results.flat()
	return shuffle(combined).slice(0, count)
}
