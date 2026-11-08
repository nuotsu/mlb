/**
 * A KBO team's registered (1군, first-team) roster from koreabaseball.com's player register
 * (Player/Register.aspx): the manager, coaches, then pitchers, catchers, infielders and
 * outfielders, each with their number, batting and throwing hands, birth date, height and weight.
 *
 * The page is an ASP.NET form: a plain GET shows one team on the latest day with a register, and
 * another team takes a postback with the page's view state (see `kboRegisterForm`).
 *
 * Shipping this needs KBO's prior approval: koreabaseball.com prohibits automated collection of
 * its data without it (see `kbo.ts`).
 */

import { cellText, kboPlayerPhotoUrl, kboPlayerUrl, kboTeamByName } from '#lib/kbo.js'

export const KBO_REGISTER_URL = 'https://www.koreabaseball.com/Player/Register.aspx'

export type KboRosterGroup = 'manager' | 'coach' | 'P' | 'C' | 'IF' | 'OF'

const GROUPS: Record<string, KboRosterGroup> = {
	감독: 'manager',
	코치: 'coach',
	투수: 'P',
	포수: 'C',
	내야수: 'IF',
	외야수: 'OF',
}

export interface KboRosterPlayer {
	/** koreabaseball.com's player ID */
	id: string
	nameKo: string
	number: string
	group: KboRosterGroup
	/** R, L or S (switch) */
	bats: string | null
	throws: string | null
	/** e.g. 우투좌타: throws right (submarine or sidearm: 우언), bats left */
	batsThrowsKo: string | null
	/** ISO date */
	birthDate: string | null
	heightCm: number | null
	weightKg: number | null
	photo: string
	href: string
}

export interface KboRoster {
	teamId: number
	/** The day the register is for, ISO */
	date: string
	players: KboRosterPlayer[]
}

const HANDS: Record<string, string> = { 우: 'R', 좌: 'L', 양: 'S' }

/** 우투좌타 (or 우언우타, a sidearm or submarine thrower) → throws R, bats L */
export function parseBatsThrows(text: string) {
	const match = text.replace(/\s/g, '').match(/^([우좌양])[투언]([우좌양])타$/)
	return {
		throws: match ? HANDS[match[1]] : null,
		bats: match ? HANDS[match[2]] : null,
	}
}

/** The view state and fields a postback for another team or day needs */
export function kboRegisterForm(html: string) {
	const value = (name: string) =>
		html.match(new RegExp(`id="${name}" value="([^"]*)"`))?.[1] ?? null
	const field = (suffix: string) =>
		html.match(new RegExp(`name="([^"]*\\$${suffix})"[^>]*value="([^"]*)"`))?.slice(1) ?? null

	const team = field('hfSearchTeam')
	const date = field('hfSearchDate')
	const button = html.match(/__doPostBack\((?:&#39;|')([^'&]*btnCalendarSelect)/)?.[1] ?? null

	if (!value('__VIEWSTATE') || !team || !date || !button) return null

	return {
		viewState: value('__VIEWSTATE')!,
		viewStateGenerator: value('__VIEWSTATEGENERATOR') ?? '',
		eventValidation: value('__EVENTVALIDATION') ?? '',
		teamField: team[0],
		team: team[1],
		dateField: date[0],
		/** `YYYYMMDD` */
		date: date[1],
		button,
	}
}

/** The form body that shows `teamCode`'s register on the page's day */
export function kboRegisterPostback(
	form: NonNullable<ReturnType<typeof kboRegisterForm>>,
	teamCode: string,
) {
	return new URLSearchParams({
		__EVENTTARGET: form.button,
		__EVENTARGUMENT: '',
		__VIEWSTATE: form.viewState,
		__VIEWSTATEGENERATOR: form.viewStateGenerator,
		__EVENTVALIDATION: form.eventValidation,
		[form.teamField]: teamCode,
		[form.dateField]: form.date,
	})
}

/**
 * The register page's team and players. Throws when it has no team or date, so a layout change
 * surfaces as an error instead of an empty roster.
 */
export function parseKboRegister(html: string): KboRoster {
	const teamName = html.match(/<h4 class="bul_history">\s*(\S+)/)?.[1]
	const team = teamName ? kboTeamByName(teamName) : undefined
	const date = html.match(/lblGameDate"[^>]*>\s*(\d{4})\.(\d{2})\.(\d{2})/)?.slice(1)
	if (!team || !date) throw new Error('No KBO register found')

	const season = Number(date[0])
	const players: KboRosterPlayer[] = []

	for (const table of html.split('<table class="tNData"').slice(1)) {
		const header = [...table.matchAll(/<th>([^<]*)<\/th>/g)].map((m) => m[1].trim())
		const group = GROUPS[header[1]]
		// The later tables are the day's registrations and removals
		if (!group) break

		const body = table.slice(table.indexOf('<tbody>'), table.indexOf('</tbody>'))
		for (const row of body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
			const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1])
			const id = cells[1]?.match(/playerId=(\d+)/)?.[1]
			if (!id) continue
			const link = cells[1].match(/href="(\/[^"]+)"/)?.[1]

			const batsThrowsKo = cellText(cells[2] ?? '') || null
			const [height, weight] = [...cellText(cells[4] ?? '').matchAll(/(\d+)\s*(?:cm|kg)/g)].map(
				(m) => Number(m[1]),
			)
			const birth = cellText(cells[3] ?? '').match(/^\d{4}-\d{2}-\d{2}$/)?.[0] ?? null

			players.push({
				id,
				nameKo: cellText(cells[1]),
				number: cellText(cells[0] ?? ''),
				group,
				...parseBatsThrows(batsThrowsKo ?? ''),
				batsThrowsKo,
				birthDate: birth,
				heightCm: height ?? null,
				weightKg: weight ?? null,
				photo: kboPlayerPhotoUrl(id, season),
				// The page's own link: a retired player's page for the manager and coaches
				href: link ? `https://www.koreabaseball.com${link}` : kboPlayerUrl(id, group === 'P'),
			})
		}
	}

	return { teamId: team.id, date: `${date[0]}-${date[1]}-${date[2]}`, players }
}
