/**
 * Parser for NPB's official standings pages (npb.jp/bis/{season}/stats/std_{c,p}.html).
 *
 * NPB has no public API, so this reads the server-rendered tables. Two layouts exist:
 * - 2025 onward: `<table class="tablefix2">` with `<tr class="ststats">` rows.
 * - 2005 to 2024: `stdTeam` / `stdscore` cells, with each team name nested in its own table.
 *
 * Both share the same column order: games, wins, losses, ties, pct, games back, home, road,
 * then one column per opponent and (from 2005, except 2020) interleague.
 */

/** NPB's `sportId` in the MLB Stats API, reused so `?sportId=31` selects NPB on /standings. */
export const NPB_SPORT_ID = 31

/** First season npb.jp publishes standings pages for. */
export const NPB_MIN_SEASON = 2005

export const NPB_LEAGUES = {
	central: { code: 'c', name: 'Central League', nameJa: 'セントラル・リーグ' },
	pacific: { code: 'p', name: 'Pacific League', nameJa: 'パシフィック・リーグ' },
} as const

export type NpbLeagueId = keyof typeof NPB_LEAGUES

export interface NpbRecord {
	wins: number
	losses: number
	ties: number
}

export interface NpbTeamStanding extends NpbRecord {
	rank: number
	/** Full Japanese name as NPB prints it, e.g. 阪神タイガース */
	nameJa: string
	/** MLB Stats API team ID, or `null` for a team not in {@link NPB_TEAMS} (same for the rest) */
	id: number | null
	/** English name */
	name: string | null
	/** Nickname, e.g. Tigers */
	teamName: string | null
	abbreviation: string | null
	games: number
	/** As printed, e.g. ".560" */
	pct: string
	/** `null` for the leader */
	gamesBack: number | null
	home: NpbRecord | null
	road: NpbRecord | null
	/** Head-to-head record keyed by the opponent's `nameJa` */
	vs: Record<string, NpbRecord>
	/** `null` when the season had no interleague play (2020) */
	interleague: NpbRecord | null
}

export interface NpbLeagueStandings {
	id: NpbLeagueId
	season: number
	name: string
	nameJa: string
	/** NPB's status line, e.g. 全日程終了 (season complete) */
	status: string | null
	teams: NpbTeamStanding[]
}

/**
 * English names and MLB Stats API team IDs (sportId 31), keyed by Japanese name with `・`
 * removed (older pages drop it). The IDs let the standings table reuse MLB's team cell; the
 * Stats API only has real logos for the Giants and Tigers, the rest show its generic ball.
 */
export const NPB_TEAMS: Record<
	string,
	{ id: number; name: string; teamName: string; abbreviation: string }
> = {
	// Central League
	読売ジャイアンツ: { id: 241, name: 'Yomiuri Giants', teamName: 'Giants', abbreviation: 'YOM' },
	阪神タイガース: { id: 341, name: 'Hanshin Tigers', teamName: 'Tigers', abbreviation: 'HAN' },
	中日ドラゴンズ: { id: 2798, name: 'Chunichi Dragons', teamName: 'Dragons', abbreviation: 'CHU' },
	広島東洋カープ: { id: 2805, name: 'Hiroshima Toyo Carp', teamName: 'Carp', abbreviation: 'HIR' },
	東京ヤクルトスワローズ: {
		id: 2673,
		name: 'Tokyo Yakult Swallows',
		teamName: 'Swallows',
		abbreviation: 'YAK',
	},
	ヤクルトスワローズ: {
		id: 2673,
		name: 'Yakult Swallows',
		teamName: 'Swallows',
		abbreviation: 'YAK',
	},
	横浜DeNAベイスターズ: {
		id: 2800,
		name: 'Yokohama DeNA BayStars',
		teamName: 'BayStars',
		abbreviation: 'YOK',
	},
	横浜ベイスターズ: {
		id: 2800,
		name: 'Yokohama BayStars',
		teamName: 'BayStars',
		abbreviation: 'YOK',
	},
	// Pacific League
	福岡ソフトバンクホークス: {
		id: 242,
		name: 'Fukuoka SoftBank Hawks',
		teamName: 'Hawks',
		abbreviation: 'FUK',
	},
	北海道日本ハムファイターズ: {
		id: 2671,
		name: 'Hokkaido Nippon-Ham Fighters',
		teamName: 'Fighters',
		abbreviation: 'NHF',
	},
	オリックスバファローズ: {
		id: 2797,
		name: 'Orix Buffaloes',
		teamName: 'Buffaloes',
		abbreviation: 'ORI',
	},
	東北楽天ゴールデンイーグルス: {
		id: 2674,
		name: 'Tohoku Rakuten Golden Eagles',
		teamName: 'Golden Eagles',
		abbreviation: 'RAK',
	},
	埼玉西武ライオンズ: {
		id: 240,
		name: 'Saitama Seibu Lions',
		teamName: 'Lions',
		abbreviation: 'SEI',
	},
	西武ライオンズ: { id: 240, name: 'Seibu Lions', teamName: 'Lions', abbreviation: 'SEI' },
	千葉ロッテマリーンズ: {
		id: 2670,
		name: 'Chiba Lotte Marines',
		teamName: 'Marines',
		abbreviation: 'LOT',
	},
}

/**
 * The All-Star Game's two sides, by npb.jp's game page code (`cl-pl-01`). The Stats API has no team
 * for them, so they get stand-in IDs: negative, so they never match a real team, and with no team
 * page to link to.
 */
export const NPB_ALL_STAR_TEAMS = {
	cl: {
		id: -1,
		name: 'Central League All-Stars',
		teamName: 'Central',
		abbreviation: 'CL',
		nameJa: 'セントラル・リーグ',
		shortNameJa: 'セ・リーグ',
		/** npb.jp's league flag, its logo on the game page */
		logo: 'https://p.npb.jp/img/common/logo/flag_central_s.gif',
	},
	pl: {
		id: -2,
		name: 'Pacific League All-Stars',
		teamName: 'Pacific',
		abbreviation: 'PL',
		nameJa: 'パシフィック・リーグ',
		shortNameJa: 'パ・リーグ',
		logo: 'https://p.npb.jp/img/common/logo/flag_pacific_s.gif',
	},
} as const

export type NpbAllStarCode = keyof typeof NPB_ALL_STAR_TEAMS

export const npbAllStarTeam = (teamId: number) =>
	Object.values(NPB_ALL_STAR_TEAMS).find(({ id }) => id === teamId)

export function npbStandingsUrl(season: number | string, league: NpbLeagueId) {
	return `https://npb.jp/bis/${season}/stats/std_${NPB_LEAGUES[league].code}.html`
}

/** Strips tags, turning `<br>` into newlines, and decodes the few entities NPB uses. */
export function cellText(html: string) {
	return html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.trim()
}

/** Collapses whitespace (including full-width spaces) used to pad names and headers. */
export const compact = (text: string) => text.replace(/[\s　]+/g, '')

/** "37-33\n(2)" → 37 wins, 33 losses, 2 ties. `***` (self) or blank → null. */
export function parseNpbRecord(text: string): NpbRecord | null {
	const match = compact(text).match(/^(\d+)-(\d+)(?:\((\d+)\))?$/)
	if (!match) return null
	return { wins: Number(match[1]), losses: Number(match[2]), ties: Number(match[3] ?? 0) }
}

interface RawTable {
	status: string | null
	headers: string[]
	rows: string[][]
}

function readCurrentLayout(html: string): RawTable | null {
	const table = html.match(/<table class="tablefix2">([\s\S]*?)<\/table>/)?.[1]
	if (!table) return null

	const before = html.slice(0, html.indexOf('<table class="tablefix2">'))
	const statuses = [...before.matchAll(/<p class="right">([\s\S]*?)<\/p>/g)]

	return {
		status: statuses.length ? cellText(statuses.at(-1)![1]) : null,
		headers: [...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => compact(cellText(m[1]))),
		rows: table
			.split(/<tr class="ststats">/)
			.slice(1)
			.map((row) => [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => cellText(m[1]))),
	}
}

function readLegacyLayout(html: string): RawTable | null {
	if (!html.includes('class="stdTeam"')) return null

	// The interleague-only table follows the league table; stop before it.
	const subSection = html.indexOf('class="stdsubSection"')
	const main = subSection === -1 ? html : html.slice(0, subSection)
	const start = main.indexOf('class="stdtblSubmain"')
	const body = start === -1 ? main : main.slice(start)

	return {
		status: html.match(/id="stupdate">([\s\S]*?)<\/div>/)?.[1].replace(/^\s*■\s*/, '') ?? null,
		headers: [...body.matchAll(/class="stdHead\w*"[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
			compact(cellText(m[1])),
		),
		rows: body
			.split('class="stdTeam"')
			.slice(1)
			.map((chunk) => {
				const name = chunk.match(/^>([\s\S]*?)<\/td>/)?.[1] ?? ''
				const scores = [...chunk.matchAll(/class="stdscore">([\s\S]*?)<\/td>/g)]
				return [cellText(name), ...scores.map((m) => cellText(m[1]))]
			}),
	}
}

/**
 * Parses one league's standings page. Throws if the page has no recognizable standings table,
 * so a layout change surfaces as an error instead of an empty table.
 */
export function parseNpbStandings(
	html: string,
	{ season, league }: { season: number; league: NpbLeagueId },
): NpbLeagueStandings {
	const raw = readCurrentLayout(html) ?? readLegacyLayout(html)

	if (!raw || !raw.rows.length) {
		throw new Error(`No NPB standings table found for ${league} ${season}`)
	}

	// Opponent columns are labelled by one character (対神, 対巨, …); the row with `***` in a
	// column is that opponent, which maps each label back to a full team name.
	const vsLabels = raw.headers.filter((h) => h.startsWith('対'))
	const hasInterleague = raw.headers.includes('交流戦')
	// cells: team, G, W, L, T, pct, GB, home, road, then opponents
	const VS_START = 9

	const names = raw.rows.map(([name]) => compact(name))
	const opponentByLabel = new Map<string, string>()

	raw.rows.forEach((cells, i) => {
		vsLabels.forEach((label, j) => {
			if (compact(cells[VS_START + j] ?? '') === '***') opponentByLabel.set(label, names[i])
		})
	})

	const teams = raw.rows.map((cells, i): NpbTeamStanding => {
		const nameJa = names[i]
		const known = NPB_TEAMS[nameJa.replace(/・/g, '')]
		const gamesBack = Number(cells[6])

		const vs: Record<string, NpbRecord> = {}
		vsLabels.forEach((label, j) => {
			const record = parseNpbRecord(cells[VS_START + j] ?? '')
			if (record) vs[opponentByLabel.get(label) ?? label.slice(1)] = record
		})

		return {
			rank: i + 1,
			nameJa,
			id: known?.id ?? null,
			name: known?.name ?? null,
			teamName: known?.teamName ?? null,
			abbreviation: known?.abbreviation ?? null,
			games: Number(cells[1]),
			wins: Number(cells[2]),
			losses: Number(cells[3]),
			ties: Number(cells[4]),
			pct: compact(cells[5]),
			gamesBack: Number.isFinite(gamesBack) && cells[6].trim() !== '' ? gamesBack : null,
			home: parseNpbRecord(cells[7] ?? ''),
			road: parseNpbRecord(cells[8] ?? ''),
			vs,
			interleague: hasInterleague ? parseNpbRecord(cells[VS_START + vsLabels.length] ?? '') : null,
		}
	})

	return {
		id: league,
		season,
		name: NPB_LEAGUES[league].name,
		nameJa: NPB_LEAGUES[league].nameJa,
		status: raw.status,
		teams,
	}
}
