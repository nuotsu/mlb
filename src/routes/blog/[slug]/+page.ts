import { error } from '@sveltejs/kit'
import { getPostEntry } from '#ui/blog/get-blog.js'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params }) => {
	const entry = getPostEntry(params.slug)

	if (!entry) {
		error(404, `Post not found: ${params.slug}`)
	}

	const [, post] = entry

	return {
		post,
	}
}
