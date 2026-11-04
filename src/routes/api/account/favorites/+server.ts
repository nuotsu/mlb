import { error } from '@sveltejs/kit'
import { sanitizeFavorite } from '#lib/account.js'
import { addFavorite, removeFavorite } from '#lib/server/account.js'
import { readJson, requireUser } from '#lib/server/guard.js'
import type { RequestHandler } from './$types'

/** Add (or relabel) a favorite: `{ href, label }` */
export const PUT: RequestHandler = async (event) => {
	const user = requireUser(event)
	const favorite = sanitizeFavorite(await readJson(event))
	if (!favorite) error(400, 'Invalid favorite')

	await addFavorite(user.id, favorite)
	return new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } })
}

/** Remove a favorite: `{ href }` */
export const DELETE: RequestHandler = async (event) => {
	const user = requireUser(event)
	const body = (await readJson(event)) as { href?: unknown } | null
	if (typeof body?.href !== 'string') error(400, 'Invalid favorite')

	await removeFavorite(user.id, body.href)
	return new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } })
}
