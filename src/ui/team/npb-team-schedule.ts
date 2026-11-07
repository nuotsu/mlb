import { toMlbScheduleGame, type LinkedMlbGame } from '#lib/npb-game-mlb.js'
import { loadNpbSchedule } from '#lib/npb-schedule.js'

export interface TeamSchedule {
	/** In date order */
	games: LinkedMlbGame[]
	allStarDate?: string
}

/** Memoized per team + season; failures are evicted so the next call retries */
const cache = new Map<string, Promise<TeamSchedule>>()

/**
 * An NPB team's regular season games from npb.jp, in the Stats API's shape and linking to our
 * NPB game pages, for the team page's calendars.
 */
export function fetchNpbTeamSchedule(teamId: number, season: number): Promise<TeamSchedule> {
	const key = `${teamId}-${season}`
	if (cache.has(key)) return cache.get(key)!

	const promise = loadNpbSchedule(season, { teamId })
		.then(({ games, allStarDates }) => ({
			games: games.map((game) => toMlbScheduleGame(game)),
			allStarDate: allStarDates[0],
		}))
		.catch((e) => {
			cache.delete(key)
			throw e
		})

	cache.set(key, promise)
	return promise
}
