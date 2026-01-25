import { getToday } from '$lib/temporal'

export const HOST = 'https://statsapi.mlb.com'

const today = getToday()
const offset = Number(today.getMonth() <= 2) // after March
const currentYear = today.getFullYear() - offset
const past_N_years = (n = 5) => Array.from({ length: n }, (_, i) => currentYear - n + i + 1)

export const PRESETS = {
	sportId: [
		{ value: '1', label: 'MLB' },
		{ value: '11', label: 'AAA' },
		{ value: '51', label: "Int'l" },
		{ value: '586', label: 'HS' },
	],
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
		{ value: (currentYear - 1).toString(), label: (currentYear - 1).toString() },
		{ value: past_N_years().join(','), label: `${past_N_years()[0]}-${currentYear}` },
	],
	jobType: [
		{ value: 'umpires', label: 'Umpires' },
		{ value: 'officialScorers', label: 'Official scorers' },
		{ value: 'datacasters', label: 'Datacasters' },
	],
	gameType: [
		{ value: 'R', label: 'Regular Season' },
		{ value: 'S', label: 'Spring Training' },
	],
	gamePk: [
		{ value: '813024', label: "'25 World Series Game 7" },
		{ value: '813031', label: "'25 NLCS Game 4" },
	],
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
		{ value: '2026-03-26', label: "'26 Opening Day" },
		{ value: '2025-11-01', label: "'25 World Series Game 7" },
	],
} satisfies Docs.EndpointParams

export const CUSTOM_ENDPOINT = {
	'/{custom}': {
		description: 'Custom endpoint for exploring unlisted API paths; enter full path starting with /api/v1/.',
		pathParams: {
			custom: [{ value: '/api/v1/' }],
		},
	},
} as const satisfies Docs.EndpointSchema

export const CUSTOM_ENDPOINT_KEY = Object.keys(CUSTOM_ENDPOINT)[0] as keyof typeof CUSTOM_ENDPOINT
export const CUSTOM_ENDPOINT_PATH = CUSTOM_ENDPOINT[CUSTOM_ENDPOINT_KEY].pathParams.custom[0].value

export const DIRECTORY: Record<string, Docs.EndpointSchema> = {
	Sport: {
		'/api/v1/sports': {
			description: 'List all sports with their IDs (MLB=1, AAA=11, etc.) and basic metadata.',
		},
		'/api/v1/divisions': {
			description:
				'Get division info (AL East, NL West, etc.) with standings order; filter by league and season.',
			queryParams: {
				leagueId: [PRESETS.leagueId[0], PRESETS.leagueId[1]],
				season: PRESETS.season,
			},
		},
		'/api/v1/leagues': {
			description: 'Get league details (American/National) including season dates and structure.',
			queryParams: {
				leagueIds: PRESETS.leagueId,
			},
		},
	},

	Schedule: {
		'/api/v1/schedule': {
			description:
				'Get game schedules by date, date range, team, or venue; returns gamePk IDs needed for other endpoints.',
			queryParams: {
				sportId: PRESETS.sportId,
				date: PRESETS.date,
				startDate: [{ value: '' }],
				endDate: [{ value: '' }],
				season: PRESETS.season.map((s) => ({ ...s, empty: true })),
				teamId: PRESETS.teamId.map((t) => ({ ...t, empty: true })),
				venueIds: PRESETS.venueId.map((v) => ({ ...v, empty: true })),
				fields: [
					{
						value: 'dates,games,officialDate,dayNight,teams,team,name',
						label: 'date + teams',
						empty: true,
					},
				],
				hydrate: [{ value: '', placeholder: 'hydrations' }],
			},
		},
		'/api/v1/schedule/postseason': {
			description:
				'Get postseason bracket and series info (World Series, LCS, LDS); includes series status and game results.',
			queryParams: {
				gameTypes: [
					{ value: 'W', label: 'World Series' },
					{ value: 'L', label: 'League Series' },
					{ value: 'D', label: 'Division Series' },
				],
				season: PRESETS.season,
				teamId: PRESETS.teamId.map((t) => ({ ...t, empty: true })),
				// seriesNumber: [{ value: '1', empty: true }],
				fields: [{ value: '' }],
			},
		},
	},
	Game: {
		'/api/v1.1/game/{gamePk}/feed/live': {
			description:
				'Complete live game feed with all plays, runners, count, matchups; use timecode to get state at specific moment.',
			pathParams: {
				gamePk: PRESETS.gamePk,
			},
			queryParams: {
				timecode: [{ value: '20251102_031510', empty: true }],
				fields: [
					{
						value: 'liveData,plays,allPlays,result,description,playEndTime',
						label: 'All plays',
					},
					{
						value: 'liveData,plays,currentPlay,result,description,playEndTime',
						label: 'Current play',
					},
				],
			},
		},
		// '/api/v1.1/game/{gamePk}/feed/live/timestamps': {
		// 	pathParams: {
		// 		gamePk: PRESETS.gamePk,
		// 	},
		// },
		'/api/v1/game/{gamePk}/boxscore': {
			description:
				'Traditional box score with batting/pitching lines, player stats, and game totals for a specific game.',
			pathParams: {
				gamePk: PRESETS.gamePk,
			},
			queryParams: {
				fields: [{ value: '' }],
			},
		},
		'/api/v1/game/{gamePk}/linescore': {
			description: 'Inning-by-inning runs, hits, errors; current inning state for live games.',
			pathParams: {
				gamePk: PRESETS.gamePk,
			},
		},
		'/api/v1/game/{gamePk}/content': {
			description:
				'Game media content including highlight videos, editorial recap, and photo galleries.',
			pathParams: {
				gamePk: PRESETS.gamePk,
			},
			queryParams: {
				fields: [{ value: '' }],
			},
		},
		'/api/v1/game/{gamePk}/contextMetrics': {
			description:
				'Advanced context stats like leverage index, win expectancy, and championship probability added.',
			pathParams: {
				gamePk: PRESETS.gamePk,
			},
		},
		'/api/v1/game/{gamePk}/winProbability': {
			description:
				'Win probability after each play; shows how each at-bat shifted the odds for home/away teams.',
			pathParams: {
				gamePk: PRESETS.gamePk,
			},
			queryParams: {
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
			description:
				'Chronological list of all plays with descriptions; lighter than live feed for historical games.',
			pathParams: {
				gamePk: PRESETS.gamePk,
			},
			queryParams: {
				fields: [{ value: 'allPlays,result,description', label: 'All Plays' }],
			},
		},
		'/api/v1/game/changes': {
			description:
				'List of games updated since a given date/time; useful for syncing or tracking postponements.',
			queryParams: {
				sportId: PRESETS.sportId,
				updatedSince: PRESETS.date,
			},
		},
		'/api/v1/gamePace': {
			description:
				'Pace of play statistics for a season: average game time, pitches per game, time between pitches.',
			queryParams: {
				sportId: PRESETS.sportId,
				season: PRESETS.season,
			},
		},
	},
	Teams: {
		'/api/v1/teams': {
			description:
				'List all teams with IDs, names, abbreviations, venue, and league/division info; filter by sport and season.',
			queryParams: {
				sportId: PRESETS.sportId,
				season: PRESETS.season,
			},
		},
		'/api/v1/teams/{teamId}': {
			description:
				'Detailed team info: full name, venue, league, division, first year, and social media links.',
			pathParams: {
				teamId: PRESETS.teamId,
			},
		},
		'/api/v1/teams/{teamId}/roster': {
			description:
				'Current or historical roster with player IDs, positions, jersey numbers, and status.',
			pathParams: {
				teamId: PRESETS.teamId,
			},
			queryParams: {
				season: PRESETS.season,
			},
		},
		'/api/v1/teams/{teamId}/history': {
			description:
				'Franchise history including former names, cities, leagues, and championship seasons.',
			pathParams: {
				teamId: PRESETS.teamId,
			},
		},
		'/api/v1/teams/{teamId}/affiliates': {
			description:
				'Minor league affiliates (AAA, AA, A+, A, Rookie) with team names and league info.',
			pathParams: {
				teamId: PRESETS.teamId,
			},
		},
	},
	People: {
		'/api/v1/people/{personId}': {
			description:
				'Player bio: birthDate, birthCity, height, weight, position, bats/throws, draft info, MLB debut date.',
			pathParams: {
				personId: PRESETS.personId,
			},
			queryParams: {
				fields: [{ value: '' }],
				hydrate: [{ value: 'currentTeam', empty: true }],
			},
		},
		'/api/v1/people/{personId}/stats': {
			description:
				'Player statistics: season or career totals for hitting/pitching/fielding; filter by gameType (regular/postseason).',
			pathParams: {
				personId: PRESETS.personId,
			},
			queryParams: {
				stats: PRESETS.stats,
				seasons: PRESETS.seasons,
				group: PRESETS.group,
				gameType: PRESETS.gameType,
			},
		},
		'/api/v1/people/{personId}/stats/game/{gamePk}': {
			description:
				"Player's stats from a specific game: at-bats, hits, RBIs, innings pitched, strikeouts, etc.",
			pathParams: {
				personId: PRESETS.personId,
				gamePk: PRESETS.gamePk,
			},
			queryParams: {
				fields: [{ value: '' }],
			},
		},
		'/api/v1/people/freeAgents': {
			description:
				'List of free agents for a given offseason with their previous team and contract status.',
			queryParams: {
				season: PRESETS.season,
			},
		},
		'/api/v1/people/changes': {
			description:
				'Players whose records changed since a date; useful for tracking roster moves and data updates.',
			queryParams: {
				updatedSince: PRESETS.date,
				fields: [{ value: 'people,id,fullName' }],
			},
		},
		'/api/v1/people/search': {
			description:
				'Search players by name (partial match); use this first to find personId for other queries.',
			queryParams: {
				names: [{ value: '' }],
			},
		},
	},
	Standings: {
		'/api/v1/standings': {
			description:
				'Current standings with W-L record, PCT, GB, streak, last 10, home/away splits by league/division.',
			queryParams: {
				leagueId: PRESETS.leagueId,
				season: PRESETS.season,
			},
		},
	},
	Stats: {
		'/api/v1/stats': {
			description:
				'General stats query for aggregated league-wide statistics by season and stat group.',
			queryParams: {
				stats: PRESETS.stats,
				group: PRESETS.group,
				season: PRESETS.season,
			},
		},
		'/api/v1/stats/leaders': {
			description:
				'League leaders in specific categories (HR, AVG, ERA, etc.); regular season or playoffs.',
			queryParams: {
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
		'/api/v1/seasons': {
			description:
				'Season metadata: regular season start/end dates, All-Star date, postseason dates, spring training info.',
			queryParams: {
				sportId: PRESETS.sportId,
				season: PRESETS.season,
			},
		},
		'/api/v1/venues': {
			description:
				'Ballpark info: location, capacity, dimensions, surface type, roof type, and timezone.',
			queryParams: {
				venueIds: PRESETS.venueId,
			},
		},
		'/api/v1/draft/{year}': {
			description:
				'MLB Draft results by year: all rounds and picks with player info, school, and signing bonus.',
			pathParams: {
				year: PRESETS.year,
			},
			queryParams: {
				fields: [
					{ value: 'drafts,rounds,picks,person,id,fullName,blurb', label: 'blurb + person' },
				],
			},
		},
		'/api/v1/transactions': {
			description:
				'Roster transactions: trades, signings, DFA, IL moves, call-ups; filter by team, player, or date range.',
			queryParams: {
				sportId: PRESETS.sportId,
				teamId: PRESETS.teamId.map((t) => ({ ...t, empty: true })),
				playerId: PRESETS.personId.map((p) => ({ ...p, empty: true })),
				date: PRESETS.date,
				startDate: [{ value: '' }],
				endDate: [{ value: '' }],
				fields: [
					{ value: 'transactions,description', label: 'description' },
					{ value: 'transactions,person,id,fullName', label: 'person' },
				],
			},
		},
		'/api/v1/uniforms/game': {
			description: 'Uniform details for specific games: jersey style, cap, pants, and special event gear.',
			queryParams: {
				gamePks: PRESETS.gamePk,
			},
		},
		'/api/v1/attendance': {
			description:
				'Attendance figures by team and season: total, average, home/away, and capacity percentage.',
			queryParams: {
				teamId: PRESETS.teamId,
				season: PRESETS.season,
			},
		},
		'/api/v1/jobs/{jobType}': {
			description:
				'Game officials by type: umpire crews, official scorers, and datacasters assigned to games.',
			pathParams: {
				jobType: PRESETS.jobType,
			},
			queryParams: {
				date: PRESETS.date,
			},
		},
	},
	Meta: {
		'/api/v1/gameStatus': {
			description:
				'All possible game status codes (Scheduled, In Progress, Final, Postponed, etc.) with descriptions.',
		},
		'/api/v1/gameTypes': {
			description:
				'Game type codes: R=Regular Season, S=Spring Training, P=Playoffs, W=World Series, etc.',
		},
	},
} as const

export const ENDPOINTS: Record<string, Docs.EndpointSchema[string]> = Object.assign(
	CUSTOM_ENDPOINT,
	DIRECTORY,
)

for (const [label, endpoints] of Object.entries(DIRECTORY)) {
	for (const [endpoint, params] of Object.entries(endpoints)) {
		ENDPOINTS[endpoint] = params
	}
}
