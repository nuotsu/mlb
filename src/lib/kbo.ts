/**
 * KBO (Korea Baseball Organization) data from koreabaseball.com: the team map shared by the
 * standings, schedule, game and roster modules (`kbo-schedule.ts`, `kbo-game.ts`,
 * `kbo-roster.ts`), and the parser for the daily standings page (TeamRankDaily.aspx).
 *
 * KBO has no public API, so this reads the server-rendered `tData` tables. The page only serves
 * the latest standings on a plain GET (other dates need an ASP.NET postback), so this supports the
 * season that page shows, which is the current or most recent one.
 *
 * Shipping this needs KBO's prior approval: koreabaseball.com's robots.txt disallows generic
 * agents, and its terms prohibit automated collection of its data without approval.
 */

/** KBO's `sportId` in the MLB Stats API, reused so `?sportId=32` selects KBO on /standings. */
export const KBO_SPORT_ID = 32

export const KBO_STANDINGS_URL = 'https://www.koreabaseball.com/Record/TeamRank/TeamRankDaily.aspx'

export interface KboRecord {
	wins: number
	losses: number
	ties: number
}

export interface KboTeamStanding extends KboRecord {
	rank: number
	/** Short Korean name as KBO prints it, e.g. 삼성 */
	nameKo: string
	/** MLB Stats API team ID, or `null` for a team not in {@link KBO_TEAMS} (same for the rest) */
	id: number | null
	/** English name */
	name: string | null
	/** Nickname, e.g. Lions */
	teamName: string | null
	abbreviation: string | null
	games: number
	/** e.g. ".647" */
	pct: string
	/** `null` for the leader */
	gamesBack: number | null
	lastTen: KboRecord | null
	/** Like the MLB Stats API's `streakCode`: `W10`, `L4`, `T1` */
	streak: string | null
	home: KboRecord | null
	road: KboRecord | null
	/** Head-to-head record keyed by the opponent's `nameKo` */
	vs: Record<string, KboRecord>
}

export interface KboStandings {
	season: number
	/** The date the standings are as of, `YYYY-MM-DD` */
	date: string
	teams: KboTeamStanding[]
}

export interface KboTeamInfo {
	/** MLB Stats API team ID (sportId 32) */
	id: number
	/** koreabaseball.com's team code, as in its game IDs: `OB` is Doosan, `HT` KIA, `WO` Kiwoom */
	code: string
	name: string
	teamName: string
	abbreviation: string
	/** Full Korean name, e.g. 두산 베어스 */
	fullNameKo: string
}

/**
 * English names and MLB Stats API team IDs (sportId 32), keyed by KBO's short Korean name. The
 * IDs let KBO pages reuse MLB's team components; the Stats API has no real KBO logos, so they
 * come from koreabaseball.com (see `teamLogoSources`).
 */
export const KBO_TEAMS: Record<string, KboTeamInfo> = {
	KIA: {
		id: 1190,
		code: 'HT',
		name: 'KIA Tigers',
		teamName: 'Tigers',
		abbreviation: 'KIA',
		fullNameKo: 'KIA 타이거즈',
	},
	삼성: {
		id: 2914,
		code: 'SS',
		name: 'Samsung Lions',
		teamName: 'Lions',
		abbreviation: 'LIO',
		fullNameKo: '삼성 라이온즈',
	},
	LG: {
		id: 2913,
		code: 'LG',
		name: 'LG Twins',
		teamName: 'Twins',
		abbreviation: 'LGT',
		fullNameKo: 'LG 트윈스',
	},
	두산: {
		id: 2911,
		code: 'OB',
		name: 'Doosan Bears',
		teamName: 'Bears',
		abbreviation: 'DSN',
		fullNameKo: '두산 베어스',
	},
	KT: {
		id: 5050,
		code: 'KT',
		name: 'KT Wiz',
		teamName: 'Wiz',
		abbreviation: 'KTW',
		fullNameKo: 'KT 위즈',
	},
	SSG: {
		id: 2915,
		code: 'SK',
		name: 'SSG Landers',
		teamName: 'Landers',
		abbreviation: 'SSG',
		fullNameKo: 'SSG 랜더스',
	},
	롯데: {
		id: 2672,
		code: 'LT',
		name: 'Lotte Giants',
		teamName: 'Giants',
		abbreviation: 'LOT',
		fullNameKo: '롯데 자이언츠',
	},
	한화: {
		id: 2912,
		code: 'HH',
		name: 'Hanwha Eagles',
		teamName: 'Eagles',
		abbreviation: 'HAN',
		fullNameKo: '한화 이글스',
	},
	NC: {
		id: 5051,
		code: 'NC',
		name: 'NC Dinos',
		teamName: 'Dinos',
		abbreviation: 'NCD',
		fullNameKo: 'NC 다이노스',
	},
	키움: {
		id: 2916,
		code: 'WO',
		name: 'Kiwoom Heroes',
		teamName: 'Heroes',
		abbreviation: 'KIW',
		fullNameKo: '키움 히어로즈',
	},
}

/** Earlier short names the schedule uses for past seasons: SSG was SK, and Kiwoom 넥센 */
const KBO_TEAM_ALIASES: Record<string, string> = { SK: 'SSG', 넥센: '키움', 히어로즈: '키움' }

/**
 * The All-Star Game's sides, 나눔 (Nanum) and 드림 (Dream), with their koreabaseball.com codes.
 * The Stats API has no team for them, so they get stand-in IDs: negative, so they never match a
 * real team, distinct from NPB's (`NPB_ALL_STAR_TEAMS`), and with no team page to link to.
 */
export const KBO_ALL_STAR_TEAMS: Record<string, KboTeamInfo> = {
	나눔: {
		id: -11,
		code: 'WE',
		name: 'Nanum All-Stars',
		teamName: 'Nanum',
		abbreviation: 'NAN',
		fullNameKo: '나눔 올스타',
	},
	드림: {
		id: -12,
		code: 'EA',
		name: 'Dream All-Stars',
		teamName: 'Dream',
		abbreviation: 'DRM',
		fullNameKo: '드림 올스타',
	},
}

const ALL_KBO_TEAMS = [...Object.values(KBO_TEAMS), ...Object.values(KBO_ALL_STAR_TEAMS)]

/** A team (or All-Star side) by its short Korean name, as the schedule prints it */
export const kboTeamByName = (nameKo: string): KboTeamInfo | undefined =>
	KBO_TEAMS[KBO_TEAM_ALIASES[nameKo] ?? nameKo] ?? KBO_ALL_STAR_TEAMS[nameKo]

/** A team (or All-Star side) by its koreabaseball.com code, e.g. `OB` */
export const kboTeamByCode = (code: string): KboTeamInfo | undefined =>
	ALL_KBO_TEAMS.find((team) => team.code === code)

/** A team (or All-Star side) by its Stats API (or stand-in) ID */
export const kboTeamById = (id: number): KboTeamInfo | undefined =>
	ALL_KBO_TEAMS.find((team) => team.id === id)

/** One of the ten KBO clubs, by Stats API team ID (a string from a route param, too) */
export const isKboTeam = (id: number | string) =>
	Object.values(KBO_TEAMS).some((team) => team.id === Number(id))

/** The All-Star side with this stand-in ID, if it is one */
export const kboAllStarTeam = (id: number) =>
	Object.values(KBO_ALL_STAR_TEAMS).find((team) => team.id === id)

/** koreabaseball.com's image CDN, which its own pages load from */
export const KBO_IMAGE_URL = 'https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE'

/**
 * koreabaseball.com's emblem for a KBO team or All-Star side: a season's (`year`), or its
 * current one (`fixed`). Transparent PNGs, wider than tall. `null` for any other team.
 */
export function kboLogoUrl(teamId: number, year: number | 'fixed') {
	const team = kboTeamById(teamId)
	return team ? `${KBO_IMAGE_URL}/emblem/regular/${year}/emblem_${team.code}.png` : null
}

/** A player's headshot on koreabaseball.com, from a season's register */
export const kboPlayerPhotoUrl = (playerId: string, season: number) =>
	`${KBO_IMAGE_URL}/person/middle/${season}/${playerId}.jpg`

/** A player's page on koreabaseball.com: the pitcher or hitter record page */
export const kboPlayerUrl = (playerId: string, pitcher = false) =>
	`https://www.koreabaseball.com/Record/Player/${pitcher ? 'PitcherDetail' : 'HitterDetail'}/Basic.aspx?playerId=${playerId}`

/** Strips tags and decodes the few entities KBO uses. */
export function cellText(html: string) {
	return html
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.trim()
}

/** The body rows of the `<table summary="…">` whose summary starts with `summaryStart`. */
function tableRows(html: string, summaryStart: string) {
	const table = html.match(
		new RegExp(`<table summary="${summaryStart}[^"]*"[^>]*>([\\s\\S]*?)</table>`),
	)?.[1]
	if (!table) return null

	const body = table.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? ''
	return [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((row) =>
		[...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => cellText(cell[1])),
	)
}

/** "45-2-24" (home/road: wins-ties-losses) → 45 wins, 24 losses, 2 ties. */
export function parseKboHomeRoad(text: string): KboRecord | null {
	const match = text.trim().match(/^(\d+)-(\d+)-(\d+)$/)
	if (!match) return null
	return { wins: Number(match[1]), ties: Number(match[2]), losses: Number(match[3]) }
}

/** "7-9-0" (head-to-head: wins-losses-ties). `■` (self) or blank → null. */
export function parseKboHeadToHead(text: string): KboRecord | null {
	const match = text.trim().match(/^(\d+)-(\d+)-(\d+)$/)
	if (!match) return null
	return { wins: Number(match[1]), losses: Number(match[2]), ties: Number(match[3]) }
}

/** "9승1무0패" (last 10: 승 win, 무 tie, 패 loss) → 9 wins, 0 losses, 1 tie. */
export function parseKboLastTen(text: string): KboRecord | null {
	const match = text.replace(/\s/g, '').match(/^(\d+)승(\d+)무(\d+)패$/)
	if (!match) return null
	return { wins: Number(match[1]), ties: Number(match[2]), losses: Number(match[3]) }
}

/** "10승" → `W10`, "4패" → `L4`, "1무" → `T1`. */
export function parseKboStreak(text: string): string | null {
	const match = text.replace(/\s/g, '').match(/^(\d+)(승|패|무)$/)
	if (!match) return null
	return `${{ 승: 'W', 패: 'L', 무: 'T' }[match[2]]}${match[1]}`
}

/** "0.647" → ".647", as MLB prints it. */
const formatPct = (text: string) => text.trim().replace(/^0(?=\.)/, '')

/**
 * Parses the standings page. Throws if the page has no recognizable standings table or date,
 * so a layout change surfaces as an error instead of an empty table.
 */
export function parseKboStandings(html: string): KboStandings {
	const date = html.match(/id="[^"]*lblSearchDateTitle">\s*(\d{4})\.(\d{2})\.(\d{2})\s*</)?.slice(1)
	const rows = tableRows(html, '순위')

	if (!date || !rows?.length) throw new Error('No KBO standings table found')

	// Head-to-head table: a row per team, its own column `■`, then a 합계 (total) column.
	const vsRows = tableRows(html, '팀간승패표') ?? []
	const vsHeaders = [
		...(html.match(/<table summary="팀간승패표"[\s\S]*?<thead>([\s\S]*?)<\/thead>/)?.[1] ?? '')
			// each header is "KT<br />(승-패-무)"; keep the team name
			.matchAll(/<th[^>]*>([\s\S]*?)(?:<br\s*\/?>[\s\S]*?)?<\/th>/g),
	].map((m) => cellText(m[1]))
	const vsByTeam = new Map(
		vsRows.map(([team, ...cells]) => {
			const vs: Record<string, KboRecord> = {}
			cells.forEach((cell, i) => {
				const opponent = vsHeaders[i + 1]
				const record = parseKboHeadToHead(cell)
				if (opponent && opponent !== '합계' && record) vs[opponent] = record
			})
			return [team, vs]
		}),
	)

	// cells: rank, team, G, W, L, T, pct, GB, last 10, streak, home, road
	const teams = rows.map((cells): KboTeamStanding => {
		const nameKo = cells[1]
		const known = KBO_TEAMS[nameKo]
		const gamesBack = Number(cells[7])

		return {
			rank: Number(cells[0]),
			nameKo,
			id: known?.id ?? null,
			name: known?.name ?? null,
			teamName: known?.teamName ?? null,
			abbreviation: known?.abbreviation ?? null,
			games: Number(cells[2]),
			wins: Number(cells[3]),
			losses: Number(cells[4]),
			ties: Number(cells[5]),
			pct: formatPct(cells[6]),
			// KBO prints 0 for the leader (and for any team tied with it)
			gamesBack: Number.isFinite(gamesBack) && gamesBack > 0 ? gamesBack : null,
			lastTen: parseKboLastTen(cells[8] ?? ''),
			streak: parseKboStreak(cells[9] ?? ''),
			home: parseKboHomeRoad(cells[10] ?? ''),
			road: parseKboHomeRoad(cells[11] ?? ''),
			vs: vsByTeam.get(nameKo) ?? {},
		}
	})

	const [year, month, day] = date
	return { season: Number(year), date: `${year}-${month}-${day}`, teams }
}

/* -------------------------------------------------------------------------------------------- */
/* koreabaseball.com's `/ws/*.asmx` grids                                                        */
/* -------------------------------------------------------------------------------------------- */

export interface KboGridCell {
	Text: string | null
	Class: string | null
	RowSpan?: string | null
}

export interface KboGridRow {
	row: KboGridCell[]
}

/**
 * A table as koreabaseball.com's web services return it, for its pages' S2i grid script to draw:
 * header, body and footer rows of cells holding HTML.
 */
export interface KboGridTable {
	headers?: KboGridRow[] | null
	rows?: KboGridRow[] | null
	tfoot?: KboGridRow[] | null
}

/** A grid, which some responses nest as a JSON string */
export function kboGrid(value: string | KboGridTable | null | undefined): KboGridTable {
	if (!value) return {}
	return typeof value === 'string' ? (JSON.parse(value) as KboGridTable) : value
}

/** A grid's rows as text, tags stripped */
export const kboGridText = (rows: KboGridRow[] | null | undefined) =>
	(rows ?? []).map(({ row }) => row.map((cell) => cellText(cell.Text ?? '')))
