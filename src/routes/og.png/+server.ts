import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { ASCII_LOGO } from '#lib/ascii-logo.js'
import { OG_IMAGE } from '#lib/seo.js'
import type { RequestHandler } from './$types'

/**
 * Rendered once at build time and served as a static file: no function invocations,
 * and the image stays in sync with the home hero's ASCII wordmark.
 *
 * Satori + resvg is what `@vercel/og` wraps; its Node build needs CommonJS globals
 * (`require`, `__dirname`) that SvelteKit's ESM output doesn't have.
 */
export const prerender = true

/** Read from the project root, which is the working directory while prerendering */
const FONTS = 'src/lib/assets/fonts'

type Node = { type: string; props: Record<string, unknown> }
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({
	type,
	props: { style, children },
})

export const GET: RequestHandler = async () => {
	// Loaded lazily so the renderers never load in the app's server function
	const [{ default: satori }, { initWasm, Resvg }] = await Promise.all([
		import('satori'),
		import('@resvg/resvg-wasm'),
	])

	const [geist, geistMono, resvgWasm] = await Promise.all([
		readFile(`${FONTS}/geist-500.ttf`),
		readFile(`${FONTS}/geist-mono-500.ttf`),
		readFile(createRequire(import.meta.url).resolve('@resvg/resvg-wasm/index_bg.wasm')),
	])

	const element = h(
		'div',
		{
			width: '100%',
			height: '100%',
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			backgroundColor: '#000',
			color: '#fff',
			fontFamily: 'Geist',
		},
		[
			h('div', { display: 'flex', flexDirection: 'column' }, [
				h(
					'div',
					{ fontFamily: 'Geist Mono', fontSize: 34, lineHeight: 1, whiteSpace: 'pre' },
					ASCII_LOGO.trimEnd(),
				),
				h('div', { alignSelf: 'flex-end', marginTop: 12, fontSize: 52 }, '.TheOhtani.com'),
			]),
			h(
				'div',
				{ marginTop: 56, fontSize: 30, color: 'rgba(255, 255, 255, 0.6)' },
				'Track MLB games, explore stats, and query the Stats API, all in one app.',
			),
		],
	)

	const svg = await satori(element as never, {
		width: OG_IMAGE.width,
		height: OG_IMAGE.height,
		fonts: [
			{ name: 'Geist', data: geist, weight: 500, style: 'normal' },
			{ name: 'Geist Mono', data: geistMono, weight: 500, style: 'normal' },
		],
	})

	await initWasm(resvgWasm)
	const png = new Resvg(svg).render().asPng()

	return new Response(new Uint8Array(png), {
		headers: { 'Content-Type': 'image/png' },
	})
}
