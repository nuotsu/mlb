import { getAllBlogs } from '$ui/blog/get-blog'

const BASE = 'https://mlb.theohtani.com'

const staticRoutes: {
	route: string
	priority: string
}[] = [
	{ route: '/', priority: '1.0' },
	{ route: '/blog', priority: '0.8' },
	{ route: '/schedule/day', priority: '0.8' },
	{ route: '/schedule/week', priority: '0.8' },
	{ route: '/standings', priority: '0.8' },
	{ route: '/stats', priority: '0.8' },
	{ route: '/teams', priority: '0.8' },
	{ route: '/player', priority: '0.8' },
	{ route: '/transactions', priority: '0.8' },
	{ route: '/api', priority: '0.7' },
]

export function GET() {
	const posts = getAllBlogs()
	const urls = [
		...staticRoutes.map(({ route, priority }) => ({
			loc: BASE + route,
			priority,
		})),
		...posts.map((p) => ({
			loc: `${BASE}/blog/${p.slug}`,
			priority: '0.6',
		})),
	]

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `<url><loc>${url.loc}</loc><priority>${url.priority}</priority><changefreq>daily</changefreq></url>`).join('\n')}
</urlset>`

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
		},
	})
}
