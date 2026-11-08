import { toMlbScheduleGame } from '#lib/kbo-game-mlb.js'
import { loadKboSchedule } from '#lib/kbo-schedule.js'
import type { TeamSchedule } from './npb-team-schedule.js'

/** Memoized per team + season; failures are evicted so the next call retries */
const cache = new Map<string, Promise<TeamSchedule>>()

/**
 * A KBO team's games from koreabaseball.com (regular season and postseason), in the Stats API's
 * shape and linking to our KBO game pages, for the team page's calendars.
 */
export function fetchKboTeamSchedule(teamId: number, season: number): Promise<TeamSchedule> {
	const key = `${teamId}-${season}`
	if (cache.has(key)) return cache.get(key)!

	const promise = loadKboSchedule(season, { teamId })
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
