import { fetchMLB } from '$lib/fetch'

export async function fetchSeasonProgress(
	sportId: string = '1',
	year: string,
	schedule: MLB.ScheduleResponse,
) {
	const regularSeason = await fetchMLB<MLB.SeasonResponse>(`/api/v1/seasons`, {
		sportId,
		season: year,
		fields: ['seasons,regularSeasonStartDate,regularSeasonEndDate'],
	})

	const games = schedule.dates?.[0]?.games ?? []

	const allTeams = games
		?.filter((g) => g.gameType === 'R')
		?.flatMap((g) => [g.teams.away, g.teams.home])

	const gamesPlayed = allTeams.length
		? Math.round(
				allTeams.reduce(
					(sum, t) => sum + (t.leagueRecord?.wins ?? 0) + (t.leagueRecord?.losses ?? 0),
					0,
				) / allTeams.length,
			)
		: 0

	const { team } = games[0]?.teams.away ?? {}

	const { totalGames } = team?.id
		? await fetchMLB<MLB.ScheduleResponse>(`/api/v1/schedule`, {
				sportId,
				teamId: team.id.toString(),
				season: year,
				gameType: 'R',
				fields: ['totalGames'],
			})
		: { totalGames: 0 }

	return {
		...(regularSeason.seasons[0] as Pick<
			MLB.SeasonDateInfo,
			'regularSeasonStartDate' | 'regularSeasonEndDate'
		>),
		gamesPlayed,
		totalGames,
	}
}
