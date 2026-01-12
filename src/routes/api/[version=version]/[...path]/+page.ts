import { redirect } from '@sveltejs/kit'

export const load = async ({ params, url }) => {
	const { version, path } = params

	const endpoint = [['api', version, path].filter(Boolean).join('/'), url.searchParams.toString()]
		.filter(Boolean)
		.join('?')

	redirect(302, '/api/playground?endpoint=' + endpoint)
}
