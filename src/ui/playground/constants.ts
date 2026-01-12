export const HOST = 'https://statsapi.mlb.com'

const today = new Date()
const offset = Number(today.getMonth() <= 3) // after April
const currentYear = today.getFullYear() - offset
const past_N_years = (n = 5) => Array.from({ length: n }, (_, i) => currentYear - n + i + 1)

export const PRESETS = {
	sportId: [{ value: '1', label: 'MLB' }],
	leagueId: [
		{ value: '103', label: 'American' },
		{ value: '104', label: 'National' },
		{ value: '103,104', label: 'AL + NL' },
	],
	teamId: [
		{ value: '119', label: 'Los Angeles Dodgers' },
		{ value: '147', label: 'New York Yankees' },
	],
	personId: [
		{ value: '660271', label: 'Shohei Ohtani' },
		{ value: '592450', label: 'Aaron Judge' },
		{ value: '669373', label: 'Tarik Skubal' },
		{ value: '121314', label: 'Jackie Robinson' },
	],
	jobType: [
		{ value: 'umpires', label: 'Umpires' },
		{ value: 'officialScorers', label: 'Official scorers' },
		{ value: 'datacasters', label: 'Datacasters' },
	],
	stats: [
		{ value: 'season', label: 'Season' },
		{ value: 'career', label: 'Career' },
	],
	group: [
		{ value: 'hitting', label: 'Hitting' },
		{ value: 'pitching', label: 'Pitching' },
		{ value: 'fielding', label: 'Fielding' },
	],
	season: [
		{ value: currentYear.toString(), label: currentYear.toString() },
		{ value: (currentYear - 1).toString(), label: (currentYear - 1).toString() },
		{ value: past_N_years().join(','), label: `${past_N_years()[0]}-${currentYear}` },
	],
	gameType: [
		{ value: 'R', label: 'Regular Season' },
		{ value: 'S', label: 'Spring Training' },
	],
	gamePk: [{ value: '813024', label: "'25 World Series Game 7" }],
	venueId: [
		{ value: '22', label: 'Dodger Stadium' },
		{ value: '3313', label: 'Yankee Stadium' },
	],
	year: [
		{ value: currentYear.toString(), label: currentYear.toString() },
		{ value: (currentYear - 1).toString(), label: (currentYear - 1).toString() },
	],
	date: [
		{ value: today.toISOString().split('T')[0], label: 'Today' },
		{ value: '2025-11-01', label: "'25 World Series Game 7" },
	],
} satisfies Docs.EndpointParams

export const CUSTOM_ENDPOINT = {
	'/api/v1/{custom}': {
		parameters: {
			custom: [{ value: '' }],
		},
	},
} satisfies Docs.EndpointSchema

export const CUSTOM_ENDPOINT_KEY = Object.keys(CUSTOM_ENDPOINT)[0] as keyof typeof CUSTOM_ENDPOINT

export const DIRECTORY: Record<string, Docs.EndpointSchema> = {
	Leagues: {
		'/api/v1/leagues': {
			parameters: {
				leagueIds: PRESETS.leagueId,
			},
		},
	},
	Teams: {
		'/api/v1/teams': {
			parameters: {
				sportId: PRESETS.sportId,
				season: PRESETS.season,
			},
		},
		'/api/v1/teams/{teamId}': {
			parameters: {
				teamId: PRESETS.teamId,
			},
		},
		'/api/v1/teams/{teamId}/roster': {
			parameters: {
				teamId: PRESETS.teamId,
				season: PRESETS.season,
			},
		},
		'/api/v1/teams/{teamId}/history': {
			parameters: {
				teamId: PRESETS.teamId,
			},
		},
		'/api/v1/teams/{teamId}/affiliates': {
			parameters: {
				teamId: PRESETS.teamId,
			},
		},
	},
	People: {
		'/api/v1/people/{personId}': {
			parameters: {
				personId: PRESETS.personId,
				hydrate: [{ value: 'currentTeam' }],
			},
		},
		'/api/v1/people/{personId}/stats': {
			parameters: {
				personId: PRESETS.personId,
				stats: PRESETS.stats,
				seasons: PRESETS.season,
				group: PRESETS.group,
				gameType: PRESETS.gameType,
			},
		},
		'/api/v1/people/freeAgents': {
			parameters: {
				season: PRESETS.season,
			},
		},
		'/api/v1/people/changes': {
			parameters: {
				updatedSince: PRESETS.date,
				fields: [{ value: 'people,id,fullName' }],
			},
		},
		'/api/v1/people/search': {
			parameters: {
				names: [{ value: '' }],
			},
		},
	},
	Schedule: {
		'/api/v1/schedule': {
			parameters: {
				sportId: PRESETS.sportId,
				date: PRESETS.date,
				hydrate: [{ value: 'linescore' }],
			},
		},
		'/api/v1/schedule/postseason': {
			parameters: {
				season: PRESETS.season,
				gameTypes: [
					{ value: 'W', label: 'World Series' },
					{ value: 'L', label: 'League Series' },
					{ value: 'D', label: 'Division Series' },
				],
			},
		},
	},
	'Game Data': {
		'/api/v1.1/game/{gamePk}/feed/live': {
			parameters: {
				gamePk: PRESETS.gamePk,
			},
		},
		'/api/v1/game/{gamePk}/boxscore': {
			parameters: {
				gamePk: PRESETS.gamePk,
			},
		},
		'/api/v1/game/{gamePk}/linescore': {
			parameters: {
				gamePk: PRESETS.gamePk,
			},
		},
		'/api/v1/game/{gamePk}/content': {
			parameters: {
				gamePk: PRESETS.gamePk,
			},
		},
		'/api/v1/game/{gamePk}/contextMetrics': {
			parameters: {
				gamePk: PRESETS.gamePk,
			},
		},
		'/api/v1/game/{gamePk}/winProbability': {
			parameters: {
				gamePk: PRESETS.gamePk,
				fields: [
					{
						value:
							'result,description,homeTeamWinProbability,awayTeamWinProbability,homeTeamWinProbabilityAdded',
						label: 'Probabilities',
					},
				],
			},
		},
		'/api/v1/game/{gamePk}/playByPlay': {
			parameters: {
				gamePk: PRESETS.gamePk,
				fields: [{ value: 'allPlays,result,description', label: 'All Plays' }],
			},
		},
		'/api/v1/game/changes': {
			parameters: {
				sportId: PRESETS.sportId,
				updatedSince: PRESETS.date,
			},
		},
		'/api/v1/gamePace': {
			parameters: {
				sportId: PRESETS.sportId,
				season: PRESETS.season,
			},
		},
	},
	Standings: {
		'/api/v1/standings': {
			parameters: {
				leagueId: PRESETS.leagueId,
				season: PRESETS.season,
			},
		},
	},
	Stats: {
		'/api/v1/stats': {
			parameters: {
				stats: PRESETS.stats,
				group: PRESETS.group,
				season: PRESETS.season,
			},
		},
		'/api/v1/stats/leaders': {
			parameters: {
				leaderCategories: [
					{ value: 'homeRuns', label: 'Home Runs' },
					{ value: 'battingAverage', label: 'Batting Average' },
				],
				leaderGameTypes: [
					{ value: 'R', label: 'Regular Season' },
					{ value: 'P', label: 'Playoffs' },
				],
				statGroup: [PRESETS.group[0], PRESETS.group[1]],
				season: PRESETS.season,
			},
		},
	},
	Other: {
		'/api/v1/sports': {},
		'/api/v1/venues': {
			parameters: {
				venueIds: PRESETS.venueId,
			},
		},
		'/api/v1/draft/{year}': {
			parameters: {
				year: PRESETS.year,
				fields: [
					{ value: 'drafts,rounds,picks,person,id,fullName,blurb', label: 'blurb + person' },
				],
			},
		},
		'/api/v1/jobs/{jobType}': {
			parameters: {
				jobType: PRESETS.jobType,
				date: PRESETS.date,
			},
		},
		'/api/v1/uniforms/game': {
			parameters: {
				gamePks: PRESETS.gamePk,
			},
		},
		'/api/v1/attendance': {
			parameters: {
				teamId: PRESETS.teamId,
				season: PRESETS.season,
			},
		},
	},
} as const

export const ENDPOINTS: Record<string, Docs.EndpointSchema> = Object.assign(
	CUSTOM_ENDPOINT,
	DIRECTORY,
)

for (const [label, endpoints] of Object.entries(DIRECTORY)) {
	for (const [endpoint, parameters] of Object.entries(endpoints)) {
		ENDPOINTS[endpoint] = parameters
	}
}
