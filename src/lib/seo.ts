/** Canonical origin: preview deployments still point canonicals and sitemaps at production */
export const SITE_URL = 'https://mlb.theohtani.com'
export const SITE_NAME = 'MLB.TheOhtani.com'
export const SITE_DESCRIPTION =
	'Live MLB scores with a custom scorebug, plus standings, stat leaders, team and player pages, postseason brackets, ABS challenge rankings, and an MLB Stats API playground.'

/** 1200x630 social preview image */
export const OG_IMAGE = { url: `${SITE_URL}/og.jpg`, width: 1200, height: 630 }

export type IndexableRoute = {
	path: string
	title: string
	description: string
}

/**
 * The main routes we want indexed, at their canonical URLs.
 *
 * Season routes (`/standings`, `/stats`, ...) 302 to `/<route>/<season>`, so list the
 * destination instead of the redirect. `/schedule/*` and `/game/*` are kept out of
 * search on purpose (robots.txt, X-Robots-Tag), and `/transactions` only redirects to a
 * dated page that changes every day.
 */
export function getIndexableRoutes(season: number | string): IndexableRoute[] {
	return [
		{
			path: '/',
			title: 'Home',
			description: "Today's MLB games, the current season at a glance, and the latest posts",
		},
		{
			path: `/standings/${season}`,
			title: `${season} MLB Standings`,
			description: 'Division, league, and wild card standings',
		},
		{
			path: `/postseason/${season}`,
			title: `${season} MLB Postseason Bracket`,
			description: 'Playoff bracket, projected from the standings until the field is set',
		},
		{
			path: `/stats/${season}`,
			title: `${season} Stat Leaders`,
			description: 'League leaders for hitting, pitching, and fielding stats',
		},
		{
			path: `/team-stats/${season}`,
			title: `${season} Team Stats`,
			description: 'Team hitting and pitching stats, ranked league-wide and within each league',
		},
		{
			path: `/abs/${season}`,
			title: `${season} ABS Challenge Rankings`,
			description: 'Which teams, players, and umpires win the most ABS ball/strike challenges',
		},
		{
			path: '/teams',
			title: 'MLB Teams',
			description: 'Every MLB team by league and division',
		},
		{
			path: '/player',
			title: 'Player Directory',
			description: 'Search any MLB player for stats, bio, awards, and pitch arsenal',
		},
		{
			path: '/blog',
			title: 'Blog',
			description: 'MLB analysis, game coverage, and app updates',
		},
		{
			path: '/api/v1',
			title: 'Stats API Playground',
			description: 'Explore the official MLB Stats API with a JSON viewer and endpoint docs',
		},
	]
}
