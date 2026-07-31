import { fetchMLB } from '$lib/fetch'
import { fetchDaySchedule } from '$lib/fetch/presets'
import { formatDate, getToday } from '$lib/temporal'

type Team = {
	id: number
	name: string
	clubName: string
	abbreviation: string
}

const TEAMS: Team[] = [
	{ id: 108, name: 'Los Angeles Angels', clubName: 'Angels', abbreviation: 'LAA' },
	{ id: 109, name: 'Arizona Diamondbacks', clubName: 'Diamondbacks', abbreviation: 'ARI' },
	{ id: 110, name: 'Baltimore Orioles', clubName: 'Orioles', abbreviation: 'BAL' },
	{ id: 111, name: 'Boston Red Sox', clubName: 'Red Sox', abbreviation: 'BOS' },
	{ id: 112, name: 'Chicago Cubs', clubName: 'Cubs', abbreviation: 'CHC' },
	{ id: 113, name: 'Cincinnati Reds', clubName: 'Reds', abbreviation: 'CIN' },
	{ id: 114, name: 'Cleveland Guardians', clubName: 'Guardians', abbreviation: 'CLE' },
	{ id: 115, name: 'Colorado Rockies', clubName: 'Rockies', abbreviation: 'COL' },
	{ id: 116, name: 'Detroit Tigers', clubName: 'Tigers', abbreviation: 'DET' },
	{ id: 117, name: 'Houston Astros', clubName: 'Astros', abbreviation: 'HOU' },
	{ id: 118, name: 'Kansas City Royals', clubName: 'Royals', abbreviation: 'KC' },
	{ id: 119, name: 'Los Angeles Dodgers', clubName: 'Dodgers', abbreviation: 'LAD' },
	{ id: 120, name: 'Washington Nationals', clubName: 'Nationals', abbreviation: 'WSH' },
	{ id: 121, name: 'New York Mets', clubName: 'Mets', abbreviation: 'NYM' },
	{ id: 133, name: 'Oakland Athletics', clubName: 'Athletics', abbreviation: 'ATH' },
	{ id: 134, name: 'Pittsburgh Pirates', clubName: 'Pirates', abbreviation: 'PIT' },
	{ id: 135, name: 'San Diego Padres', clubName: 'Padres', abbreviation: 'SD' },
	{ id: 136, name: 'Seattle Mariners', clubName: 'Mariners', abbreviation: 'SEA' },
	{ id: 137, name: 'San Francisco Giants', clubName: 'Giants', abbreviation: 'SF' },
	{ id: 138, name: 'St. Louis Cardinals', clubName: 'Cardinals', abbreviation: 'STL' },
	{ id: 139, name: 'Tampa Bay Rays', clubName: 'Rays', abbreviation: 'TB' },
	{ id: 140, name: 'Texas Rangers', clubName: 'Rangers', abbreviation: 'TEX' },
	{ id: 141, name: 'Toronto Blue Jays', clubName: 'Blue Jays', abbreviation: 'TOR' },
	{ id: 142, name: 'Minnesota Twins', clubName: 'Twins', abbreviation: 'MIN' },
	{ id: 143, name: 'Philadelphia Phillies', clubName: 'Phillies', abbreviation: 'PHI' },
	{ id: 144, name: 'Atlanta Braves', clubName: 'Braves', abbreviation: 'ATL' },
	{ id: 145, name: 'Chicago White Sox', clubName: 'White Sox', abbreviation: 'CWS' },
	{ id: 146, name: 'Miami Marlins', clubName: 'Marlins', abbreviation: 'MIA' },
	{ id: 147, name: 'New York Yankees', clubName: 'Yankees', abbreviation: 'NYY' },
	{ id: 158, name: 'Milwaukee Brewers', clubName: 'Brewers', abbreviation: 'MIL' },
]

const DATE_OFFSETS: Record<string, number> = {
	today: 0,
	tonight: 0,
	yesterday: -1,
	tomorrow: 1,
}

const WEEKDAYS: Record<string, number> = {
	sunday: 0,
	monday: 1,
	tuesday: 2,
	wednesday: 3,
	thursday: 4,
	friday: 5,
	saturday: 6,
}

const WEEKDAY_PATTERN = Object.keys(WEEKDAYS).join('|')

const INTENTS = {
	boxscore: /\bbox\s?scores?\b/,
	standings: /\bstandings?\b/,
	stats: /\b(stats?|leaders?|leaderboards?)\b/,
	schedule: /\b(matchups?|schedules?|games?|scores?|playing)\b/,
	teamPage: /\b(rosters?|teams?|club)\b/,
} as const

/** Words that carry intent/date meaning and should be stripped before a player name lookup */
const NOISE_WORDS = new RegExp(
	`\\b(today|tonight|yesterday|tomorrow|this|next|${WEEKDAY_PATTERN}|profiles?|players?|pages?|shows?|views?|open|go|to|me|my|for|the|a|an|of|all|seasons?|years?|career)\\b`,
	'g',
)

const INTENT_WORDS =
	/\b(box\s?scores?|standings?|stats?|leaders?|leaderboards?|matchups?|schedules?|games?|scores?|playing|rosters?|teams?|club)\b/g

function normalize(query: string) {
	return query
		.toLowerCase()
		.replace(/['’]s\b/g, ' ')
		.replace(/[^a-z0-9\s.-]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

/** Leftover tokens after stripping intents/noise — treated as a player name candidate */
function extractPlayerName(q: string) {
	return q.replace(INTENT_WORDS, ' ').replace(NOISE_WORDS, ' ').replace(/\s+/g, ' ').trim()
}

function teamAliases(team: Team) {
	const aliases = [team.name, team.clubName, team.abbreviation]
	// "dodger game" should match Dodgers (skip Red/White Sox)
	if (/s$/i.test(team.clubName) && !/sox$/i.test(team.clubName)) {
		aliases.push(team.clubName.slice(0, -1))
	}
	return aliases
}

function matchTeam(q: string) {
	let matched: Team | undefined
	let matchedAlias = ''

	for (const team of TEAMS) {
		for (const alias of teamAliases(team)) {
			const a = alias.toLowerCase()
			// abbreviations must match as standalone words; longer aliases win
			if (a.length > matchedAlias.length && new RegExp(`\\b${a}\\b`).test(q)) {
				matched = team
				matchedAlias = a
			}
		}
	}

	return matched
}

function matchDate(q: string) {
	const date = getToday()

	const relative = Object.keys(DATE_OFFSETS).find((w) => new RegExp(`\\b${w}\\b`).test(q))
	if (relative) {
		date.setDate(date.getDate() + DATE_OFFSETS[relative])
		return { date: formatDate(date, { locale: 'en-CA' }), explicit: true }
	}

	const weekdayMatch = q.match(new RegExp(`\\b(?:(this|next)\\s+)?(${WEEKDAY_PATTERN})\\b`))
	if (weekdayMatch) {
		const [, modifier, weekday] = weekdayMatch
		const target = WEEKDAYS[weekday]
		const todayDow = date.getDay()
		let delta = (target - todayDow + 7) % 7
		// "next saturday" skips today when today is already that weekday
		if (modifier === 'next' && delta === 0) delta = 7
		date.setDate(date.getDate() + delta)
		return { date: formatDate(date, { locale: 'en-CA' }), explicit: true }
	}

	return { date: formatDate(date, { locale: 'en-CA' }), explicit: false }
}

async function findGame(teamId: number, date: string) {
	const schedule = await fetchDaySchedule(date)
	const games = schedule?.dates?.[0]?.games ?? []
	const teamGames = games.filter(
		(game) => game.teams?.home?.team?.id === teamId || game.teams?.away?.team?.id === teamId,
	)

	// doubleheaders: prefer the game currently in progress
	return teamGames.find((game) => game.status?.abstractGameState === 'Live') ?? teamGames[0]
}

async function searchPeople(name: string) {
	const { people = [] } = await fetchMLB<MLB.PersonResponse>('/api/v1/people/search', {
		names: name,
		fields: 'people,id,fullName,active',
	})

	return people.find((person) => person.active) ?? people[0]
}

async function findPlayer(name: string) {
	const player = await searchPeople(name)
	if (player) return player

	// "ohtanis seasons stats" → leftover "ohtanis"; retry without a trailing possessive s
	if (name.length > 3 && /[a-z]s$/i.test(name)) {
		return searchPeople(name.replace(/s$/i, ''))
	}
}

/**
 * Resolves a free-form query to an app route (best guess).
 * Never returns results — only a destination href.
 */
export async function resolveQuery(query: string): Promise<string> {
	const q = normalize(query)
	if (!q) return '/'

	const team = matchTeam(q)
	const { date, explicit: hasDate } = matchDate(q)
	const name = extractPlayerName(q)

	const wantsBoxscore = INTENTS.boxscore.test(q)
	const wantsSchedule = INTENTS.schedule.test(q)
	const wantsStandings = INTENTS.standings.test(q)
	const wantsStats = INTENTS.stats.test(q)

	if (team) {
		if (wantsBoxscore || wantsSchedule || hasDate) {
			const game = await findGame(team.id, date)
			if (game?.gamePk) return `/game/${game.gamePk}${wantsBoxscore ? '#boxscore' : ''}`
		}
		// no game that day (or roster/team page query) — fall back to the team page
		return `/teams/${team.id}`
	}

	// Prefer a player when the query still has a name remnant after stripping intents
	// ("show my ohtanis seasons stats" → Ohtani, not /stats)
	if (name.length >= 3) {
		const player = await findPlayer(name)
		if (player) return `/player/${player.id}`
		if (!wantsStandings && !wantsStats && !wantsSchedule && !wantsBoxscore) {
			return `/player?query=${encodeURIComponent(name)}`
		}
	}

	if (wantsStandings) return '/standings'
	if (wantsStats) return '/stats'
	if (wantsSchedule || wantsBoxscore) return `/schedule/day/${date}`

	return '/player'
}
