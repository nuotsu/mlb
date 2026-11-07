/// <reference types="bun" />

import { expect, test } from 'bun:test'
import { createMemoryCache } from './memory-cache'

test('evicts the oldest key past `max`', async () => {
	const cache = createMemoryCache<number, number>({ max: 2 })
	let loads = 0
	const load = (n: number) => () => Promise.resolve((loads++, n))

	await cache.get(1, 1000, load(1), 0)
	await cache.get(2, 1000, load(2), 0)
	await cache.get(3, 1000, load(3), 0)
	expect(loads).toBe(3)

	await cache.get(3, 1000, load(3), 0)
	await cache.get(2, 1000, load(2), 0)
	expect(loads).toBe(3)
	await cache.get(1, 1000, load(1), 0)
	expect(loads).toBe(4)
})
