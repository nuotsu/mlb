import { getIndexableRoutes, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '#lib/seo.js'
import { getToday } from '#lib/temporal.js'
import { getAllBlogs, getPostPath } from '#ui/blog/get-blog.js'
import type { RequestHandler } from './$types'

/** https://llmstxt.org */
export const GET: RequestHandler = () => {
	const season = getToday().getFullYear()
	const routes = getIndexableRoutes(season).filter(
		({ path }) => path !== '/blog' && path !== '/api/v1',
	)
	const posts = getAllBlogs()

	const link = (title: string, path: string, description?: string) =>
		`- [${title}](${SITE_URL}${path})${description ? `: ${description}` : ''}`

	const body = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

MLB stands for Mitchell's Live scoreBug: an independent, fan-built web app on top of the official MLB Stats API (statsapi.mlb.com). It is not affiliated with Major League Baseball. Season pages take any year from 1876 on, e.g. \`/standings/1998\`.

## Pages

${routes.map(({ title, path, description }) => link(title, path, description)).join('\n')}
- [Team page](${SITE_URL}/teams/119): roster, injured list, and transactions; swap in any MLB team id (119 is the Dodgers)
- [Player page](${SITE_URL}/player/660271): stats, bio, awards, and pitch arsenal; swap in any MLB person id (660271 is Shohei Ohtani)

## Data access

- [MCP server](${SITE_URL}/mcp): Streamable HTTP MCP server (POST only) exposing schedule, standings, player stats, transactions, and more from the MLB Stats API
- [Stats API Playground](${SITE_URL}/api/v1): replace \`https://statsapi.mlb.com/api/v1/...\` with \`${SITE_URL}/api/v1/...\` to view any Stats API response
- [Source code](https://github.com/nuotsu/mlb)

## Blog

${posts.map((post) => link(post.title, getPostPath(post), post.description)).join('\n')}

## Optional

- [Sitemap](${SITE_URL}/sitemap.xml)
- [MLB copyright notice](https://gdx.mlb.com/components/copyright.txt)
`

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
		},
	})
}
