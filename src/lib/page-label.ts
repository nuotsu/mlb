import type { RouteId } from '$app/types'
import type { PageData as GamePageData } from '../routes/game/[gamePk=gamePk]/$types.js'
import type { PageData as PlayerPageData } from '../routes/player/[personId=personId]/$types.js'
import type { PageData as TeamPageData } from '../routes/teams/[teamId=teamId]/$types.js'
import { SHARED_TEAM_NAMES } from './shared-team-names.js'

/*
	`page_label` on `$pageview`: a readable name for pages whose URL is only a numeric ID, so
	insights can rank games, teams and players by name. Built from what the route's load already
	returns; other routes get no label.
*/

type TeamAbbr = Pick<MLB.Team, 'name' | 'abbreviation'>

/** Just what each label reads from its route's data */
type LabelData = {
	'/game/[gamePk=gamePk]': {
		game: Pick<MLB.Game, 'officialDate' | 'gameNumber'> & {
			teams: { away: { team: TeamAbbr }; home: { team: TeamAbbr } }
		}
	}
	'/teams/[teamId=teamId]': {
		team: Pick<MLB.TeamDetailed, 'name' | 'active'> & {
			sport?: Pick<MLB.Sport, 'id' | 'abbreviation'>
			league?: Pick<MLB.League, 'abbreviation'>
		}
	}
	'/player/[personId=personId]': {
		person: Pick<MLB.Person, 'fullName'>
	}
}

type LabeledRoute = keyof LabelData

/** Fails to compile if a route is renamed, or its load stops returning what its label reads */
type Check<R extends LabeledRoute & RouteId, Data extends LabelData[R]> = [R, Data]
export type _RouteDataCheck = [
	Check<'/game/[gamePk=gamePk]', GamePageData>,
	Check<'/teams/[teamId=teamId]', TeamPageData>,
	Check<'/player/[personId=personId]', PlayerPageData>,
]

/**
 * The label for the page at `routeId` showing `data` (`page.data`), or `undefined` for routes
 * without one (and when the data isn't there, e.g. on an error page)
 */
export function pageLabel(
	routeId: RouteId | string | null,
	data: Partial<LabelData[LabeledRoute]> & Record<string, unknown>,
): string | undefined {
	switch (routeId as LabeledRoute) {
		case '/game/[gamePk=gamePk]': {
			const { game } = data as Partial<LabelData['/game/[gamePk=gamePk]']>
			return game ? gameLabel(game) : undefined
		}
		case '/teams/[teamId=teamId]': {
			const { team } = data as Partial<LabelData['/teams/[teamId=teamId]']>
			return team?.name ? teamLabel(team) : undefined
		}
		case '/player/[personId=personId]': {
			const { person } = data as Partial<LabelData['/player/[personId=personId]']>
			return person?.fullName || undefined
		}
		default:
			return undefined
	}
}

/** "CWS vs LAD - 2/19/27", with " (G2)" for the second game of a doubleheader */
function gameLabel({
	teams,
	officialDate,
	gameNumber,
}: LabelData['/game/[gamePk=gamePk]']['game']) {
	const abbr = ({ abbreviation, name }: TeamAbbr) => abbreviation || name
	// The official date is the calendar date (YYYY-MM-DD); no time zone to get wrong
	const [year, month, day] = officialDate.split('-').map(Number)
	const date = `${month}/${day}/${String(year).slice(-2)}`

	return `${abbr(teams.away.team)} vs ${abbr(teams.home.team)} - ${date}${gameNumber === 2 ? ' (G2)' : ''}`
}

/**
 * The full name, plus the sport (or league, when teams in one sport share it) for a name more
 * than one team has. Current MLB clubs keep the plain name: "Los Angeles Angels" is the club,
 * the 1903–57 PCL team is "Los Angeles Angels (Minors)".
 */
function teamLabel({ name, active, sport, league }: LabelData['/teams/[teamId=teamId]']['team']) {
	const sharedBy = Object.hasOwn(SHARED_TEAM_NAMES, name) ? SHARED_TEAM_NAMES[name] : undefined
	if (!sharedBy || (sport?.id === 1 && active)) return name

	const sharedInSport = sharedBy.filter((s) => s === sport?.abbreviation).length > 1
	const qualifier =
		(sharedInSport && league?.abbreviation) || sport?.abbreviation || league?.abbreviation

	return qualifier ? `${name} (${qualifier})` : name
}
