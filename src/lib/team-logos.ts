import { isNpbTeam, npbLogoUrl } from '#lib/npb-roster.js'
import { npbAllStarTeam } from '#lib/npb.js'

/**
 * Where a team's logo can come from, best first, for an `<img>` to step through on `error`.
 *
 * The Stats API has cap logos for MLB clubs, and a generic ball as every other team's "spot".
 * NPB teams use npb.jp's official logo first (this year's, else last year's: a new season's go
 * up when npb.jp is ready), falling back to the Stats API's (a real cap only for the Giants and
 * Tigers) and then that ball.
 *
 * `variant` is the cap for a light background or a dark one (e.g. the team's color).
 */
export function teamLogoSources(teamId: number, variant: 'light' | 'dark' = 'light') {
	// NPB's All-Star sides: npb.jp's league flag, as the Stats API has no team for them
	const allStar = npbAllStarTeam(teamId)
	if (allStar) return [allStar.logo]

	const year = new Date().getFullYear()
	const cap = `https://www.mlbstatic.com/team-logos/team-cap-on-${variant}/${teamId}.svg`
	const spot = `https://midfield.mlbstatic.com/v1/team/${teamId}/spots/72`

	if (isNpbTeam(teamId)) {
		return [npbLogoUrl(teamId, year)!, npbLogoUrl(teamId, year - 1)!, cap, spot]
	}

	return [cap, spot]
}

/** npb.jp's logos are square GIFs on white: shown whole, on white, not on the team's color */
export const isNpbLogo = (src: string) => src.startsWith('https://p.npb.jp/')

/** The Stats API's spot: a full-bleed circle, not a logo to pad */
export const isTeamSpot = (src: string) => src.startsWith('https://midfield.mlbstatic.com/')

/**
 * The team's logo is npb.jp's, which sits on white, so the team's color behind it (`--team-bg`,
 * from the Stats API's generic light gray spot) is left off and the text keeps its own color
 */
export const usesNpbLogo = (teamId: number) => isNpbTeam(teamId) || !!npbAllStarTeam(teamId)
