/**
 * Parser for NPB's official English roster pages (npb.jp/bis/eng/teams/rst_{code}.html).
 *
 * npb.jp only publishes the current roster, so there is no season or date to ask for. The page
 * lists the manager, then players by position (pitchers, catchers, infielders, outfielders), once
 * for the registered roster and again for the developmental squad. It has no coaching staff.
 */

/** npb.jp's roster page code for each NPB team, keyed by its MLB Stats API team ID. */
export const NPB_ROSTER_CODES: Record<number, string> = {
	241: 'g', // Yomiuri Giants
	341: 't', // Hanshin Tigers
	2798: 'd', // Chunichi Dragons
	2805: 'c', // Hiroshima Toyo Carp
	2673: 's', // Tokyo Yakult Swallows
	2800: 'db', // Yokohama DeNA BayStars
	242: 'h', // Fukuoka SoftBank Hawks
	2671: 'f', // Hokkaido Nippon-Ham Fighters
	2797: 'b', // Orix Buffaloes
	2674: 'e', // Tohoku Rakuten Golden Eagles
	240: 'l', // Saitama Seibu Lions
	2670: 'm', // Chiba Lotte Marines
}

export const isNpbTeam = (teamId: number | string) => Number(teamId) in NPB_ROSTER_CODES

export function npbRosterUrl(teamId: number | string) {
	const code = NPB_ROSTER_CODES[Number(teamId)]
	if (!code) throw new Error(`No NPB roster page for team ${teamId}`)
	return `https://npb.jp/bis/eng/teams/rst_${code}.html`
}

export type NpbPosition = 'P' | 'C' | 'IF' | 'OF'

export interface NpbRosterPlayer {
	/** npb.jp's player ID, from the link to their page */
	id: string
	/** As printed, e.g. "00" and "011" (developmental numbers start with 0) */
	number: string
	/** Last, First, e.g. "Abe, Shinnosuke" */
	name: string
	/** https://npb.jp/bis/eng/players/{id}.html */
	href: string
	position: NpbPosition
	/** ISO date */
	birthDate: string | null
	/** cm */
	height: number | null
	/** kg */
	weight: number | null
	throws: string | null
	bats: string | null
	/** On the developmental squad (育成) rather than the registered roster (支配下) */
	developmental: boolean
	/** No longer on the team (traded, released, retired), still listed for the season */
	departed: boolean
	/** e.g. "Traded to Seibu (Jul. 30)." */
	note: string | null
}

export interface NpbRoster {
	/** e.g. "Yomiuri Giants" */
	team: string
	season: number | null
	/** npb.jp's as-of line, e.g. "2026 Season Final" */
	status: string | null
	manager: { number: string; name: string; birthDate: string | null } | null
	players: NpbRosterPlayer[]
}

const POSITIONS: Record<string, NpbPosition> = {
	PITCHERS: 'P',
	CATCHERS: 'C',
	INFIELDERS: 'IF',
	OUTFIELDERS: 'OF',
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Mar. 20, 1979" or "May 21, 2001" → "1979-03-20" */
export function parseNpbDate(text: string): string | null {
	const match = text.match(/^([A-Z][a-z]{2})[a-z]*\.?\s+(\d{1,2}),\s*(\d{4})$/)
	const month = match ? MONTHS.indexOf(match[1]) + 1 : 0
	if (!match || !month) return null
	return `${match[3]}-${String(month).padStart(2, '0')}-${match[2].padStart(2, '0')}`
}

/** Strips tags and decodes the few entities npb.jp uses; `<br />` alone means empty. */
function cellText(html: string) {
	return html
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&gt;/g, '>')
		.replace(/&lt;/g, '<')
		.replace(/&amp;/g, '&')
		.replace(/\s+/g, ' ')
		.trim()
}

const number = (text: string) => (/^\d+$/.test(text) ? Number(text) : null)

/**
 * Parses a team's roster page. Throws if the page has no roster table, so a layout change
 * surfaces as an error instead of an empty roster.
 */
export function parseNpbRoster(html: string): NpbRoster {
	const tables = [
		...html.matchAll(/<table[^>]*class="rosterlisttbl"[^>]*>([\s\S]*?)<\/table>/g),
	].map((m) => m[1])

	if (!tables.length) throw new Error('No NPB roster table found')

	let manager: NpbRoster['manager'] = null
	const players: NpbRosterPlayer[] = []

	// The first table is the registered roster, any after it the developmental squad
	tables.forEach((table, t) => {
		let section = ''

		for (const [, rowClass, row] of table.matchAll(/<tr class="(\w+)">([\s\S]*?)<\/tr>/g)) {
			if (rowClass === 'rosterMainHead') {
				section = cellText(row.match(/class="rosterPos"[^>]*>([\s\S]*?)<\/th>/)?.[1] ?? '')
				continue
			}

			const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1])
			const [no, name, born, height, weight, throws, bats, note] = cells.map(cellText)

			if (section === 'MANAGER') {
				manager = { number: no, name, birthDate: parseNpbDate(born) }
				continue
			}

			const position = POSITIONS[section]
			const id = cells[1]?.match(/players\/(\d+)\.html/)?.[1]
			if (!position || !id) continue

			players.push({
				id,
				number: no,
				name,
				href: `https://npb.jp/bis/eng/players/${id}.html`,
				position,
				birthDate: parseNpbDate(born),
				height: number(height),
				weight: number(weight),
				throws: throws || null,
				bats: bats || null,
				developmental: t > 0,
				departed: rowClass === 'rosterRetire',
				note: note || null,
			})
		}
	})

	if (!players.length) throw new Error('No players found on the NPB roster page')

	// The site header has its own <h1>; the team's sits in the roster title
	const header = html.match(/id="tedivtitle">([\s\S]*?)<\/table>/)?.[1] ?? ''
	const title = header.match(/<h2>([\s\S]*?)<\/h2>/)?.[1] ?? ''

	return {
		team: cellText(header.match(/<h1>([\s\S]*?)<\/h1>/)?.[1] ?? ''),
		season: number(title.match(/\d{4}/)?.[0] ?? ''),
		status: cellText(html.match(/class="rosterUpdate">([\s\S]*?)<\/div>/)?.[1] ?? '') || null,
		manager,
		players,
	}
}
