import { fetchMLB } from '#lib/fetch/index.js'
import { getIndexableRoutes, SITE_URL } from '#lib/seo.js'
import { getToday } from '#lib/temporal.js'
import { getAllBlogs, getPostPath } from '#ui/blog/get-blog.js'
import type { RequestHandler } from './$types'

type SitemapUrl = { loc: string; lastmod?: string }

export const GET: RequestHandler = async ({ fetch }) => {
	const season = getToday().getFullYear()
	const posts = getAllBlogs()

	const teams = await fetchMLB<MLB.TeamsResponse>(
		'/api/v1/teams',
		{ sportId: '1', fields: ['teams,id'] },
		{ fetch },
	)
		.then((res) => res.teams ?? [])
		.catch(() => [])

	const urls: SitemapUrl[] = [
		...getIndexableRoutes(season).map(({ path }) => ({
			loc: SITE_URL + path,
			// The home page and blog index change whenever a post goes up
			lastmod: path === '/' || path === '/blog' ? posts[0]?.date : undefined,
		})),
		...teams.map((team) => ({ loc: `${SITE_URL}/teams/${team.id}` })),
		...posts.map((post) => ({ loc: SITE_URL + getPostPath(post), lastmod: post.date })),
	]

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(({ loc, lastmod }) => `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>`

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
		},
	})
}
