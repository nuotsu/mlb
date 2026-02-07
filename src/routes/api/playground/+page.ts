import { redirect } from '@sveltejs/kit'

export const load = async ({ url }) => {
	const endpoint = url.searchParams.get('endpoint')

	if (endpoint) {
		const decoded = decodeURIComponent(endpoint)
		const target = decoded.startsWith('api/') ? '/' + decoded : '/api'
		redirect(302, target)
	}

	redirect(302, '/api')
}
