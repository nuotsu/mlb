export const HOST = 'https://statsapi.mlb.com/api/v1'

const today = new Date()
const offset = Number(today.getMonth() <= 3) // after April
const currentYear = today.getFullYear() - offset
const past_N_years = (n = 5) => Array.from({ length: n }, (_, i) => currentYear - n + i + 1)

export const PRESETS: Docs.EndpointParameter = {
	sportId: [{ value: '1', label: 'MLB' }],
	leagueId: [
		{ value: '103', label: 'AL' },
		{ value: '104', label: 'NL' },
		{ value: '103,104', label: 'AL, NL' },
	],
	teamId: [{ value: '119', label: 'Los Angeles Dodgers' }],
	personId: [
		{ value: '660271', label: 'Shohei Ohtani' },
		{ value: '592450', label: 'Aaron Judge' },
		{ value: '669373', label: 'Tarik Skubal' },
		{ value: '121314', label: 'Jackie Robinson' },
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
	],
	seasons: [
		{ value: currentYear.toString(), label: currentYear.toString() },
		{ value: past_N_years().join(','), label: `${past_N_years()[0]}-${currentYear}` },
	],
	gameType: [
		{ value: 'R', label: 'Regular Season' },
		{ value: 'S', label: 'Spring Training' },
	],
	gamePk: [{ value: '813024', label: "'25 World Series Game 7" }],
	date: [
		{ value: today.toISOString().split('T')[0], label: 'Today' },
		{ value: '2025-11-01', label: "'25 World Series Game 7" },
	],
	hydrate: [{ value: '', label: '' }],
} as const

export const DIRECTORY: Record<string, Docs.EndpointFragment> = {
	Players: {
		'/people/{personId}': {
			parameters: {
				personId: PRESETS.personId,
			},
		},
		'/people/{personId}/stats': {
			parameters: {
				personId: PRESETS.personId,
				stats: PRESETS.stats,
				group: PRESETS.group,
				seasons: PRESETS.seasons,
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
	},
	Schedule: {
		'/schedule': {
			parameters: {
				sportId: PRESETS.sportId,
				date: PRESETS.date,
				hydrate: [{ value: 'linescore', label: 'Hydrate' }],
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
	},
} as const

export let ENDPOINTS: Record<string, Docs.EndpointFragment> = {}

for (const [label, endpoints] of Object.entries(DIRECTORY)) {
	for (const [endpoint, parameters] of Object.entries(endpoints)) {
		ENDPOINTS[endpoint] = parameters
	}
}
