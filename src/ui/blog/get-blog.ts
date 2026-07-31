import { dev } from '$app/environment'
import { formatDate, slash } from '$lib/temporal'

function isPublished(metadata: { draft?: boolean } | undefined) {
	return dev || !metadata?.draft
}

export function getAllBlogs() {
	const modules = import.meta.glob<any>('./posts/*.md', { eager: true })

	const posts = Object.entries(modules)
		.filter(([, module]) => isPublished(module.metadata))
		.map(([path, module]) => {
			const slug = path.split('/').at(-1)?.replace('.md', '')
			return {
				slug,
				...module.metadata,
				date: formatDate(module.metadata?.date.split('T')[0], { locale: 'en-CA' }),
			}
		})

	posts.sort((a, b) => new Date(slash(b.date)).getTime() - new Date(slash(a.date)).getTime())

	return posts
}

export function getPostEntry(slug: string) {
	const modules = import.meta.glob<any>('./posts/*.md', { eager: true })

	return Object.entries(modules).find(([path, module]) => {
		const filename = path.split('/').at(-1)?.replace('.md', '')
		return filename === slug && isPublished(module.metadata)
	})
}
