/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import { withBaseJersey } from './uniforms'

describe('withBaseJersey', () => {
	test('swaps the jersey for the side’s base one, keeping the pants', () => {
		expect(withBaseJersey(['139_pants_2_2026', '139_jersey_6_2026'], 'away')).toEqual([
			'139_pants_2_2026',
			'139_jersey_2_2026',
		])
		expect(withBaseJersey(['158_pants_1_2026', '158_jersey_4_2026'], 'home')).toEqual([
			'158_pants_1_2026',
			'158_jersey_1_2026',
		])
	})

	test('already the base jersey', () => {
		expect(withBaseJersey(['139_pants_2_2026', '139_jersey_2_2026'], 'away')).toBeNull()
		expect(withBaseJersey(['158_pants_1_2026', '158_jersey_1_2026'], 'home')).toBeNull()
	})
})
