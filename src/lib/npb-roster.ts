/**
 * Parsers for an NPB team's roster on npb.jp, merged into one {@link NpbRoster}:
 *
 * - The English roster page (npb.jp/bis/eng/teams/rst_{code}.html) is the base: the manager, then
 *   players by position group (pitchers, catchers, infielders, outfielders), once for the
 *   registered roster and again for the developmental squad. It has no coaching staff.
 * - The Japanese roster page (npb.jp/bis/teams/rst_{code}.html) has the same players and IDs, for
 *   their Japanese names.
 * - The fielding stats pages (npb.jp/bis/{season}/stats/idf{1,2}_{code}.html, first team and
 *   farm) narrow a position group to the position played most (1B, 2B, 3B, SS). They list players
 *   by Japanese name only, and NPB doesn't split the outfield into LF/CF/RF.
 *
 * npb.jp only publishes the current roster, so there is no date to ask for.
 */

export interface NpbTeamInfo {
	/** npb.jp's page code, e.g. `db` in rst_db.html */
	code: string
	/** The owning company and/or home, e.g. Yokohama DeNA */
	franchiseName: string
	/** e.g. BayStars */
	clubName: string
}

/** npb.jp page codes and official names for each NPB team, keyed by its MLB Stats API team ID. */
export const NPB_TEAM_INFO: Record<number, NpbTeamInfo> = {
	// Central League
	241: { code: 'g', franchiseName: 'Yomiuri', clubName: 'Giants' },
	341: { code: 't', franchiseName: 'Hanshin', clubName: 'Tigers' },
	2798: { code: 'd', franchiseName: 'Chunichi', clubName: 'Dragons' },
	2805: { code: 'c', franchiseName: 'Hiroshima Toyo', clubName: 'Carp' },
	2673: { code: 's', franchiseName: 'Tokyo Yakult', clubName: 'Swallows' },
	2800: { code: 'db', franchiseName: 'Yokohama DeNA', clubName: 'BayStars' },
	// Pacific League
	242: { code: 'h', franchiseName: 'Fukuoka SoftBank', clubName: 'Hawks' },
	2671: { code: 'f', franchiseName: 'Hokkaido Nippon-Ham', clubName: 'Fighters' },
	2797: { code: 'b', franchiseName: 'Orix', clubName: 'Buffaloes' },
	2674: { code: 'e', franchiseName: 'Tohoku Rakuten', clubName: 'Golden Eagles' },
	240: { code: 'l', franchiseName: 'Saitama Seibu', clubName: 'Lions' },
	2670: { code: 'm', franchiseName: 'Chiba Lotte', clubName: 'Marines' },
}

export const isNpbTeam = (teamId: number | string) => Number(teamId) in NPB_TEAM_INFO

function teamCode(teamId: number | string) {
	const info = NPB_TEAM_INFO[Number(teamId)]
	if (!info) throw new Error(`No NPB team ${teamId}`)
	return info.code
}

export function npbRosterUrl(teamId: number | string, lang: 'en' | 'ja' = 'en') {
	return `https://npb.jp/bis/${lang === 'en' ? 'eng/' : ''}teams/rst_${teamCode(teamId)}.html`
}

/** Individual fielding stats: `level` 1 is the first team, 2 the farm team */
export function npbFieldingUrl(season: number, teamId: number | string, level: 1 | 2) {
	return `https://npb.jp/bis/${season}/stats/idf${level}_${teamCode(teamId)}.html`
}

/** npb.jp's 144×180 headshot, filed under the uniform number padded to three digits */
export function npbPhotoUrl(season: number, teamId: number | string, number: string, id: string) {
	return `https://p.npb.jp/players_photo/${season}/180/${teamCode(teamId)}/${number.padStart(3, '0')}_${id}.jpg`
}

/**
 * npb.jp's 120×120 team logo for a season (a GIF on white), or `null` for a non-NPB team. Newer
 * seasons' logos go up when npb.jp is ready, so callers should fall back to the year before.
 */
export function npbLogoUrl(teamId: number | string, season: number) {
	const code = NPB_TEAM_INFO[Number(teamId)]?.code
	return code ? `https://p.npb.jp/img/common/logo/${season}/logo_${code}_l.gif` : null
}

/** The roster page's position groups */
export type NpbPositionGroup = 'P' | 'C' | 'IF' | 'OF'

/** A position on the fielding stats pages */
export type NpbFieldingPosition = 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'OF'

export interface NpbRosterPlayer {
	/** npb.jp's player ID, from the link to their page */
	id: string
	/** As printed, e.g. "00", or three digits ("011", "127") on the developmental squad */
	number: string
	/** Last, First, e.g. "Abe, Shinnosuke" */
	name: string
	/** Last First, e.g. "阿部 慎之助" (one word for players known by one name) */
	nameJa: string | null
	/** https://npb.jp/bis/eng/players/{id}.html */
	href: string
	photo: string | null
	group: NpbPositionGroup
	/** The position played most this season (first team and farm), else the roster's group */
	position: NpbFieldingPosition | NpbPositionGroup
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

export interface NpbManager {
	number: string
	name: string
	nameJa: string | null
	birthDate: string | null
}

export interface NpbRoster {
	/** As the page prints it, e.g. "Yomiuri Giants" */
	team: string
	season: number | null
	/** npb.jp's as-of line, e.g. "2026 Season Final" */
	status: string | null
	manager: NpbManager | null
	players: NpbRosterPlayer[]
}

const MANAGER = new Set(['MANAGER', '監督'])

const GROUPS: Record<string, NpbPositionGroup> = {
	PITCHERS: 'P',
	CATCHERS: 'C',
	INFIELDERS: 'IF',
	OUTFIELDERS: 'OF',
	投手: 'P',
	捕手: 'C',
	内野手: 'IF',
	外野手: 'OF',
}

const FIELDING_POSITIONS: Record<string, NpbFieldingPosition> = {
	投手: 'P',
	捕手: 'C',
	一塁手: '1B',
	二塁手: '2B',
	三塁手: '3B',
	遊撃手: 'SS',
	外野手: 'OF',
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Mar. 20, 1979", "May 21, 2001" or "1979.03.20" → "1979-03-20" */
export function parseNpbDate(text: string): string | null {
	const dotted = text.match(/^(\d{4})\.(\d{2})\.(\d{2})$/)
	if (dotted) return `${dotted[1]}-${dotted[2]}-${dotted[3]}`

	const match = text.match(/^([A-Z][a-z]{2})[a-z]*\.?\s+(\d{1,2}),\s*(\d{4})$/)
	const month = match ? MONTHS.indexOf(match[1]) + 1 : 0
	if (!match || !month) return null
	return `${match[3]}-${String(month).padStart(2, '0')}-${match[2].padStart(2, '0')}`
}

/**
 * Strips tags and decodes the few entities npb.jp uses; `<br />` alone means empty. `\s` covers
 * the full-width space between Japanese family and given names, so it comes out half-width.
 */
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

/** Joins a Japanese name across pages: no spaces, no `*` (left-handed) mark */
const nameKey = (name: string) => name.replace(/[\s*]/g, '')

const number = (text: string) => (/^\d+$/.test(text) ? Number(text) : null)

/**
 * Parses a team's roster page, English or Japanese. Throws if the page has no roster table, so a
 * layout change surfaces as an error instead of an empty roster. `nameJa` and `photo` are left
 * empty and `position` is the roster's group, for {@link buildNpbRoster} to fill in.
 */
export function parseNpbRoster(html: string): NpbRoster {
	const tables = [
		...html.matchAll(/<table[^>]*class="rosterlisttbl"[^>]*>([\s\S]*?)<\/table>/g),
	].map((m) => m[1])

	if (!tables.length) throw new Error('No NPB roster table found')

	let manager: NpbManager | null = null
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

			if (MANAGER.has(section)) {
				manager = { number: no, name, nameJa: null, birthDate: parseNpbDate(born) }
				continue
			}

			const group = GROUPS[section]
			const path = cells[1]?.match(/href="(\/bis\/(?:eng\/)?players\/(\d+)\.html)"/)
			if (!group || !path) continue

			players.push({
				id: path[2],
				number: no,
				name,
				nameJa: null,
				href: `https://npb.jp${path[1]}`,
				photo: null,
				group,
				position: group,
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

/** Games played at each position, keyed by Japanese name (see `nameKey`) */
export type NpbFielding = Map<string, Partial<Record<NpbFieldingPosition, number>>>

/** Parses an individual fielding stats page: one table per position, each headed by an `<h5>`. */
export function parseNpbFielding(html: string): NpbFielding {
	const fielding: NpbFielding = new Map()

	for (const [, heading, table] of html.matchAll(
		/<h5>([\s\S]*?)<\/h5>\s*<table[^>]*>([\s\S]*?)<\/table>/g,
	)) {
		const position = FIELDING_POSITIONS[cellText(heading)]
		if (!position) continue

		for (const [, row] of table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
			const [name, games] = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
				cellText(m[1]),
			)
			const count = number(games ?? '')
			if (!name || !count) continue

			const key = nameKey(name)
			const record = fielding.get(key) ?? {}
			record[position] = (record[position] ?? 0) + count
			fielding.set(key, record)
		}
	}

	return fielding
}

/**
 * Merges the English roster with the Japanese one (names, joined on player ID, or uniform number
 * for the manager) and fielding stats (most-played position, summed across pages), and adds
 * photo URLs. Pitchers stay `P`; anyone without fielding stats keeps their roster group.
 */
export function buildNpbRoster({
	teamId,
	en,
	ja,
	fielding = [],
}: {
	teamId: number
	en: NpbRoster
	ja?: NpbRoster | null
	fielding?: NpbFielding[]
}): NpbRoster {
	const namesJa = new Map(ja?.players.map(({ id, nameJa, name }) => [id, nameJa ?? name]))

	return {
		...en,
		manager: en.manager && {
			...en.manager,
			nameJa: ja?.manager?.number === en.manager.number ? ja.manager.name : null,
		},
		players: en.players.map((player) => {
			const nameJa = namesJa.get(player.id) ?? null

			return {
				...player,
				nameJa: nameJa && formatNameJa(nameJa, player.name),
				photo: en.season ? npbPhotoUrl(en.season, teamId, player.number, player.id) : null,
				position:
					player.group === 'P' || !nameJa
						? player.group
						: (mostPlayed(fielding, nameKey(nameJa)) ?? player.group),
			}
		}),
	}
}

/** Each katakana syllable's consonant, by class (see `latinConsonants`); vowels and marks have none */
const KANA_CONSONANTS: [RegExp, string][] = [
	[/[カキクケコガギグゲゴ]/, 'K'],
	[/[サシスセソザジズゼゾ]/, 'S'],
	[/[タテトダヂヅデド]/, 'T'],
	[/[チツ]/, 'TS'],
	[/[ナニヌネノン]/, 'N'],
	[/[ハヒヘホ]/, 'H'],
	[/フ/, 'F'],
	[/[バビブベボヴ]/, 'B'],
	[/[パピプペポ]/, 'P'],
	[/[マミムメモ]/, 'M'],
	[/[ヤユヨ]/, 'Y'],
	[/[ラリルレロ]/, 'R'],
	[/ワ/, 'W'],
]

function kanaConsonants(kana: string) {
	return [...kana].map((c) => KANA_CONSONANTS.find(([re]) => re.test(c))?.[1][0] ?? '').join('')
}

/**
 * A romanized name's consonants in the same classes, as katakana would hear them: L is R, V is
 * B, D is T, G and C are K (C is S before E, I, Y), Z is S. J is its own class, matching the H of
 * Spanish names (ホセ) and the S row of English ones (ジョン). Silent H after a consonant is dropped.
 */
function latinConsonants(name: string) {
	return name
		.toLowerCase()
		.replace(/ph/g, 'f')
		.replace(/([bcdfgkpstwz])h/g, '$1')
		.replace(/c(?=[eiy])/g, 's')
		.replace(/[^a-z]/g, '')
		.replace(/[aeiouy]/g, (v, i) => (v === 'y' && i === 0 ? 'Y' : ''))
		.replace(
			/[a-z]/g,
			(c) =>
				({
					l: 'R',
					r: 'R',
					v: 'B',
					b: 'B',
					d: 'T',
					t: 'T',
					g: 'K',
					c: 'K',
					k: 'K',
					q: 'K',
					x: 'K',
					z: 'S',
					s: 'S',
					j: 'J',
				})[c] ?? c.toUpperCase(),
		)
}

const sameConsonant = (kana: string, latin: string) =>
	kana === latin ||
	(latin === 'J' && (kana === 'H' || kana === 'S')) ||
	(kana === 'F' && latin === 'H')

/** Longest common subsequence of two consonant strings */
function sharedConsonants(kana: string, latin: string) {
	const row = Array<number>(latin.length + 1).fill(0)
	for (const k of kana) {
		let diagonal = 0
		for (let j = 1; j <= latin.length; j++) {
			const above = row[j]
			row[j] = sameConsonant(k, latin[j - 1]) ? diagonal + 1 : Math.max(row[j], row[j - 1])
			diagonal = above
		}
	}
	return row[latin.length]
}

/**
 * Foreign players are listed in katakana by surname alone (ルイーズ); this adds their English
 * first initial, "J. ルイーズ", and tidies one already written full-width (Ｅ．ラミレス). Players
 * registered by given name in katakana (リチャード for Sunagawa, Richard) are told apart by which
 * English name the katakana sounds more like, and left as they are.
 */
export function formatNameJa(nameJa: string, name: string) {
	const written = nameJa.match(/^([Ａ-Ｚ])．(.+)$/)
	if (written) return `${String.fromCharCode(written[1].charCodeAt(0) - 0xfee0)}. ${written[2]}`

	if (!/^[ァ-ヶー]+$/.test(nameJa)) return nameJa

	const [last, first] = name.split(',').map((part) => part.trim())
	if (!first || !last) return nameJa

	const kana = kanaConsonants(nameJa)
	const surname = sharedConsonants(kana, latinConsonants(last))
	// A tie goes to the surname, the usual listing (Abreu, Albert: アブレウ)
	const isSurname = surname > 0 && surname >= sharedConsonants(kana, latinConsonants(first))

	return isSurname ? `${first[0].toUpperCase()}. ${nameJa}` : nameJa
}

function mostPlayed(fielding: NpbFielding[], key: string) {
	const games: Partial<Record<NpbFieldingPosition, number>> = {}

	for (const page of fielding) {
		for (const [position, count] of Object.entries(page.get(key) ?? {})) {
			if (position === 'P') continue
			const p = position as NpbFieldingPosition
			games[p] = (games[p] ?? 0) + count
		}
	}

	return (Object.entries(games) as [NpbFieldingPosition, number][]).sort(
		([, a], [, b]) => b - a,
	)[0]?.[0]
}
