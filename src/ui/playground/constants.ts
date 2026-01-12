export const HOST = 'https://statsapi.mlb.com/api/v1'

const today = new Date()
const offset = Number(today.getMonth() <= 3) // after April
const currentYear = today.getFullYear() - offset
const past_N_years = (n = 5) => Array.from({ length: n }, (_, i) => currentYear - n + i + 1)

export const PRESETS = {
	sportId: [{ value: '1', label: 'MLB' }],
	leagueId: [
		{ value: '103', label: 'AL' },
		{ value: '104', label: 'NL' },
		{ value: '103,104', label: 'AL, NL' },
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
	year: [
		{ value: currentYear.toString(), label: currentYear.toString() },
		{ value: (currentYear - 1).toString(), label: (currentYear - 1).toString() },
	],
	date: [
		{ value: today.toISOString().split('T')[0], label: 'Today' },
		{ value: '2025-11-01', label: "'25 World Series Game 7" },
	],
} satisfies Docs.EndpointParameter

export const DIRECTORY: Record<string, Docs.EndpointFragment> = {
	Leagues: {
		'/leagues': {
			parameters: {
				leagueIds: PRESETS.leagueId,
			},
		},
	},
	Teams: {
		'/teams': {
			parameters: {
				sportId: PRESETS.sportId,
				season: PRESETS.season,
			},
		},
		'/teams/{teamId}': {
			parameters: {
				teamId: PRESETS.teamId,
			},
		},
		'/teams/{teamId}/roster': {
			parameters: {
				teamId: PRESETS.teamId,
				season: PRESETS.season,
			},
		},
		'/teams/{teamId}/history': {
			parameters: {
				teamId: PRESETS.teamId,
			},
		},
		'/teams/{teamId}/affiliates': {
			parameters: {
				teamId: PRESETS.teamId,
			},
		},
	},
	People: {
		'/people/{personId}': {
			parameters: {
				personId: PRESETS.personId,
				hydrate: [{ value: 'currentTeam' }],
			},
		},
		'/people/{personId}/stats': {
			parameters: {
				personId: PRESETS.personId,
				stats: PRESETS.stats,
				seasons: PRESETS.season,
				group: PRESETS.group,
				gameType: PRESETS.gameType,
			},
		},
		'/people/freeAgents': {
			parameters: {
				season: PRESETS.season,
			},
		},
		'/people/changes': {
			parameters: {
				updatedSince: PRESETS.date,
				fields: [{ value: 'people,id,fullName' }],
			},
		},
		'/people/search': {
			parameters: {
				names: [{ value: '' }],
			},
		},
	},
	Schedule: {
		'/schedule': {
			parameters: {
				sportId: PRESETS.sportId,
				date: PRESETS.date,
				hydrate: [{ value: 'linescore' }],
			},
		},
		'/schedule/postseason': {
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
		'/game/{gamePk}/boxscore': {
			parameters: {
				gamePk: PRESETS.gamePk,
			},
		},
		'/game/{gamePk}/linescore': {
			parameters: {
				gamePk: PRESETS.gamePk,
			},
		},
	},
	Standings: {
		'/standings': {
			parameters: {
				leagueId: PRESETS.leagueId,
				season: PRESETS.season,
			},
		},
	},
	Stats: {
		'/stats': {
			parameters: {
				stats: PRESETS.stats,
				group: PRESETS.group,
				season: PRESETS.season,
			},
		},
		'/stats/leaders': {
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
		'/sports': {},
		'/venues': {},
		'/uniforms/game': {
			parameters: {
				gamePks: PRESETS.gamePk,
			},
		},
		'/jobs/{jobType}': {
			parameters: {
				jobType: PRESETS.jobType,
				date: PRESETS.date,
			},
		},
		'/draft/{year}': {
			parameters: {
				year: PRESETS.year,
				fields: [
					{ value: 'drafts,rounds,picks,person,id,fullName,blurb', label: 'blurb + person' },
				],
			},
		},
		'/{custom}': {
			parameters: {
				custom: [{ value: '' }],
			},
		},
	},
} as const

export let ENDPOINTS: Record<string, Docs.EndpointFragment> = {}

for (const [label, endpoints] of Object.entries(DIRECTORY)) {
	for (const [endpoint, parameters] of Object.entries(endpoints)) {
		ENDPOINTS[endpoint] = parameters
	}
}
