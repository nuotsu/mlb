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

	const { team, leagueRecord } = schedule.dates?.[0]?.games[0].teams.away ?? {}

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
		gamesPlayed: (leagueRecord?.wins ?? 0) + (leagueRecord?.losses ?? 0),
		totalGames,
	}
}
