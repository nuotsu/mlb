import { getPostEntry } from '#ui/blog/get-blog.js'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params }) => {
	const entry = getPostEntry(params.slug)

	if (!entry) {
		throw new Error(`Post not found: ${params.slug}`)
	}

	const [path, post] = entry

	return {
		post,
	}
}
