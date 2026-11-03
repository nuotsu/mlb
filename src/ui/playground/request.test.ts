import { cacheControlFor, toUpstreamUrl } from '#lib/server/playground-proxy.js'
import { describe, expect, test } from 'bun:test'
import { CUSTOM_ENDPOINT_KEY, DIRECTORY } from './constants'
import { initialValues, resolveRequest } from './request'
import { endpointToUrl, matchEndpoint } from './utils'

describe('resolveRequest', () => {
	test('fills path params and drops empty query params', () => {
		const key = '/api/v1.1/game/{gamePk}/feed/live'
		const r = resolveRequest(key, { gamePk: '849812', timecode: '', fields: '', hydrate: '' })

		expect(r.endpoint).toBe('/api/v1.1/game/849812/feed/live')
		expect(r.mlbUrl).toBe('https://statsapi.mlb.com/api/v1.1/game/849812/feed/live')
		expect(r.proxyUrl).toBe('/api/proxy/v1.1/game/849812/feed/live')
		// `fields` has a default, so clearing it is kept in the deep link
		expect(r.pageUrl).toBe('/api/v1.1/game/849812/feed/live?fields=')
		expect(r.valid).toBe(true)
	})

	test('deep links round-trip through matchEndpoint + initialValues', () => {
		const key = '/api/v1/schedule'
		const values = { ...initialValues(key), teamId: '119', fields: 'dates,games' }
		const r = resolveRequest(key, values)
		const url = new URL(r.pageUrl, 'https://x')
		const match = matchEndpoint(url.pathname)!

		expect(match.key).toBe(key)
		const reopened = initialValues(match.key, {
			...match.pathParams,
			...Object.fromEntries(url.searchParams),
		})
		expect(resolveRequest(match.key, reopened).endpoint).toBe(r.endpoint)
		expect(r.pageUrl).toContain('fields=dates,games')
	})

	test('missing path params invalidate the request', () => {
		const r = resolveRequest('/api/v1/teams/{teamId}', { teamId: ' ' })
		expect(r.valid).toBe(false)
		expect(r.missing).toEqual(['teamId'])
	})

	test('custom endpoints', () => {
		const ok = resolveRequest(CUSTOM_ENDPOINT_KEY, { custom: 'api/v1/teams?sportId=1&x=' })
		expect(ok.endpoint).toBe('/api/v1/teams?sportId=1')
		expect(ok.pageUrl).toBe('/api/v1/teams?sportId=1&x=')
		expect(ok.valid).toBe(true)

		expect(resolveRequest(CUSTOM_ENDPOINT_KEY, { custom: '/api/v1/' }).valid).toBe(false)
		expect(resolveRequest(CUSTOM_ENDPOINT_KEY, { custom: '/api/v2/teams' }).valid).toBe(false)
	})
})

describe('endpoint directory', () => {
	const keys = Object.values(DIRECTORY).flatMap((group) => Object.keys(group))

	test.each(keys)('%s deep link resolves to itself', (key) => {
		const url = endpointToUrl(key)
		expect(matchEndpoint(url)?.key).toBe(key)
		expect(resolveRequest(key, initialValues(key)).valid).toBe(true)
	})

	test('excluded endpoints stay out', () => {
		for (const dead of ['feed/color', 'stats/streaks', 'homeRunDerby', 'jobs/umpires/games']) {
			expect(keys.some((k) => k.includes(dead))).toBe(false)
		}
	})
})

describe('proxy guard', () => {
	test('allows only statsapi /api/v1 and /api/v1.1', () => {
		expect(toUpstreamUrl('v1/teams', '?sportId=1&x=')?.toString()).toBe(
			'https://statsapi.mlb.com/api/v1/teams?sportId=1',
		)
		expect(toUpstreamUrl('v1.1/game/1/feed/live', '')).not.toBeNull()
		expect(toUpstreamUrl('v2/teams', '')).toBeNull()
		expect(toUpstreamUrl('v1/../../evil', '')).toBeNull()
		expect(toUpstreamUrl('v1/%2e%2e/%2e%2e/x', '')).toBeNull()
		expect(toUpstreamUrl('/evil.com/api/v1/teams', '')).toBeNull()
		expect(toUpstreamUrl('v1\\..\\x', '')).toBeNull()
		expect(toUpstreamUrl('', '')).toBeNull()
	})

	test('cache policy', () => {
		expect(cacheControlFor('/api/v1.1/game/1/feed/live')).toContain('s-maxage=10,')
		expect(cacheControlFor('/api/v1.1/game/1/feed/live/diffPatch')).toContain('s-maxage=10,')
		expect(cacheControlFor('/api/v1/schedule/postseason')).toContain('s-maxage=10,')
		expect(cacheControlFor('/api/v1/gameTypes')).toContain('s-maxage=86400')
		expect(cacheControlFor('/api/v1/sports/1')).toContain('s-maxage=86400')
		expect(cacheControlFor('/api/v1/sports/1/players')).toContain('s-maxage=60,')
		expect(cacheControlFor('/api/v1/teams/119/roster')).toBe(
			'public, s-maxage=60, stale-while-revalidate=300',
		)
	})
})

describe('param values from inputs', () => {
	test('number inputs bind numbers or null', () => {
		const key = '/api/v1/teams/{teamId}/roster'
		expect(resolveRequest(key, { teamId: 119, season: 2025 }).endpoint).toBe(
			'/api/v1/teams/119/roster?season=2025',
		)
		expect(resolveRequest(key, { teamId: '119', season: null }).pageUrl).toBe(
			'/api/v1/teams/119/roster?season=',
		)
	})

	test('v1 deep links fall back to v1.1 endpoints (and back)', () => {
		expect(matchEndpoint('/api/v1/game/849812/feed/live')).toEqual({
			key: '/api/v1.1/game/{gamePk}/feed/live',
			pathParams: { gamePk: '849812' },
		})
		expect(matchEndpoint('/api/v1.1/teams')?.key).toBe('/api/v1/teams')
		expect(matchEndpoint('/api/v1/nope')).toBeNull()
	})
})
