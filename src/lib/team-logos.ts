import { isNpbTeam, npbLogoUrl } from '#lib/npb-roster.js'

/**
 * Where a team's logo can come from, best first, for an `<img>` to step through on `error`.
 *
 * The Stats API has cap logos for MLB clubs (and the Giants and Tigers), and a generic ball as
 * every other team's "spot". NPB teams try npb.jp's logo (this year's, else last year's: a new
 * season's go up when npb.jp is ready) before that ball.
 *
 * `variant` is the cap for a light background or a dark one (e.g. the team's color).
 */
export function teamLogoSources(teamId: number, variant: 'light' | 'dark' = 'light') {
	const year = new Date().getFullYear()

	return [
		`https://www.mlbstatic.com/team-logos/team-cap-on-${variant}/${teamId}.svg`,
		...[npbLogoUrl(teamId, year), npbLogoUrl(teamId, year - 1)].filter((url) => url !== null),
		`https://midfield.mlbstatic.com/v1/team/${teamId}/spots/72`,
	]
}

/** npb.jp's logos are square GIFs on white: shown whole, on white, not on the team's color */
export const isNpbLogo = (src: string) => src.startsWith('https://p.npb.jp/')

/** The Stats API's spot: a full-bleed circle, not a logo to pad */
export const isTeamSpot = (src: string) => src.startsWith('https://midfield.mlbstatic.com/')

/** NPB teams the Stats API has a real logo for; the rest show npb.jp's (see `teamLogoSources`) */
const NPB_TEAMS_WITH_STATS_API_LOGOS = new Set([241, 341])

/**
 * The team's logo is npb.jp's, which sits on white, so the team's color behind it (`--team-bg`,
 * from the Stats API's generic light gray spot) is left off and the text keeps its own color
 */
export const usesNpbLogo = (teamId: number) =>
	isNpbTeam(teamId) && !NPB_TEAMS_WITH_STATS_API_LOGOS.has(teamId)
