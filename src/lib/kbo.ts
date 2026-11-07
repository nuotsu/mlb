/**
 * Parser for KBO's official daily standings page (koreabaseball.com, TeamRankDaily.aspx).
 *
 * KBO has no public API, so this reads the server-rendered `tData` tables. The page only serves
 * the latest standings on a plain GET (other dates need an ASP.NET postback), so this supports the
 * season that page shows, which is the current or most recent one.
 *
 * Shipping this needs KBO's prior approval: koreabaseball.com prohibits automated collection of
 * its data without it.
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

/**
 * English names and MLB Stats API team IDs (sportId 32), keyed by KBO's short Korean name. The
 * IDs let the standings table reuse MLB's team cell; the Stats API has no real KBO logos, so every
 * team shows its generic ball.
 */
export const KBO_TEAMS: Record<
	string,
	{ id: number; name: string; teamName: string; abbreviation: string }
> = {
	KIA: { id: 1190, name: 'KIA Tigers', teamName: 'Tigers', abbreviation: 'KIA' },
	삼성: { id: 2914, name: 'Samsung Lions', teamName: 'Lions', abbreviation: 'LIO' },
	LG: { id: 2913, name: 'LG Twins', teamName: 'Twins', abbreviation: 'LGT' },
	두산: { id: 2911, name: 'Doosan Bears', teamName: 'Bears', abbreviation: 'DSN' },
	KT: { id: 5050, name: 'KT Wiz', teamName: 'Wiz', abbreviation: 'KTW' },
	SSG: { id: 2915, name: 'SSG Landers', teamName: 'Landers', abbreviation: 'SSG' },
	롯데: { id: 2672, name: 'Lotte Giants', teamName: 'Giants', abbreviation: 'LOT' },
	한화: { id: 2912, name: 'Hanwha Eagles', teamName: 'Eagles', abbreviation: 'HAN' },
	NC: { id: 5051, name: 'NC Dinos', teamName: 'Dinos', abbreviation: 'NCD' },
	키움: { id: 2916, name: 'Kiwoom Heroes', teamName: 'Heroes', abbreviation: 'KIW' },
}

/** Strips tags and decodes the few entities KBO uses. */
function cellText(html: string) {
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
