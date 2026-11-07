import { describe, expect, test } from 'bun:test'
import { getIndexableRoutes } from './seo.ts'

describe('getIndexableRoutes', () => {
	const paths = getIndexableRoutes(2026).map(({ path }) => path)

	test('lists season routes at their canonical destination, not the redirect', () => {
		for (const route of ['/standings', '/postseason', '/stats', '/team-stats', '/abs']) {
			expect(paths).toContain(`${route}/2026`)
			expect(paths).not.toContain(route)
		}
		expect(paths).toContain('/api/v1')
		expect(paths).not.toContain('/api')
	})

	test('leaves out routes blocked by robots.txt', () => {
		expect(paths.some((path) => /^\/(schedule|game)\//.test(path))).toBe(false)
	})
})
