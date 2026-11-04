// Bun resolves package.json "imports" literally, so `#lib/abs.js` looks for
// src/lib/abs.js. Vite and TypeScript map that to abs.ts; this does the same
// for `bun test`.
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { plugin } from 'bun'

const roots: Record<string, string> = {
	lib: resolve(import.meta.dir, '../src/lib'),
	ui: resolve(import.meta.dir, '../src/ui'),
}

plugin({
	name: 'subpath-imports-ts',
	setup(build) {
		build.onResolve({ filter: /^#(lib|ui)\/.+\.js$/ }, ({ path }) => {
			const [, root, rest] = path.match(/^#(lib|ui)\/(.+)\.js$/)!
			const base = resolve(roots[root], rest)
			for (const ext of ['.ts', '.svelte.ts', '.js']) {
				if (existsSync(base + ext)) return { path: base + ext }
			}
		})
	},
})
