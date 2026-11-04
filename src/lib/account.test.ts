/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import {
	mergeAccountState,
	parseFavoriteHref,
	sanitizeFavorite,
	sanitizeSettings,
	type AccountState,
} from './account'

const state = (partial: Partial<AccountState>): AccountState => ({
	favorites: [],
	settings: {},
	settingsUpdatedAt: 0,
	...partial,
})

describe('parseFavoriteHref', () => {
	test('parses the three href shapes ToggleFavorite writes', () => {
		expect(parseFavoriteHref('/teams/147')).toEqual({ type: 'team', mlbId: 147 })
		expect(parseFavoriteHref('/player/660271')).toEqual({ type: 'player', mlbId: 660271 })
		expect(parseFavoriteHref('/game/776543')).toEqual({ type: 'game', mlbId: 776543 })
	})

	test('rejects anything else', () => {
		for (const href of ['/teams/', '/teams/abc', '/teams/1/x', '/player/0', '/x/1', 1, null]) {
			expect(parseFavoriteHref(href)).toBeNull()
		}
	})
})

describe('sanitizeFavorite', () => {
	test('keeps href and label only, truncating long labels', () => {
		expect(sanitizeFavorite({ href: '/teams/147', label: 'NYY', extra: 1 })).toEqual({
			href: '/teams/147',
			label: 'NYY',
		})
		expect(sanitizeFavorite({ href: '/teams/147', label: 'x'.repeat(100) })?.label).toHaveLength(64)
		expect(sanitizeFavorite({ href: '/teams/147' })).toBeNull()
	})
})

describe('sanitizeSettings', () => {
	test('drops unknown keys and invalid values', () => {
		expect(
			sanitizeSettings({
				colorScheme: 'purple',
				spoilerPrevention: [
					{ id: 147, abbreviation: 'NYY' },
					{ id: 147, abbreviation: 'NYY' },
					'x',
				],
				onboardingDismissed: ['install-pwa', '<script>'],
				evil: true,
			}),
		).toEqual({
			spoilerPrevention: [{ id: 147, abbreviation: 'NYY' }],
			onboardingDismissed: ['install-pwa'],
		})
	})
})

describe('mergeAccountState', () => {
	const nyy = { href: '/teams/147', label: 'NYY' }
	const lad = { href: '/teams/119', label: 'LAD' }
	const ohtani = { href: '/player/660271', label: 'Ohtani' }

	test('unions favorites, account first, without duplicates', () => {
		const merged = mergeAccountState(
			state({ favorites: [nyy, lad], settingsUpdatedAt: 1 }),
			state({ favorites: [lad, ohtani] }),
		)
		expect(merged.favorites).toEqual([nyy, lad, ohtani])
	})

	test('newest settings win', () => {
		const account = state({ settings: { colorScheme: 'dark' }, settingsUpdatedAt: 200 })
		const older = state({ settings: { colorScheme: 'light' }, settingsUpdatedAt: 100 })
		const newer = state({ settings: { colorScheme: 'light' }, settingsUpdatedAt: 300 })

		expect(mergeAccountState(account, older).settings.colorScheme).toBe('dark')
		expect(mergeAccountState(account, newer)).toMatchObject({
			settings: { colorScheme: 'light' },
			settingsUpdatedAt: 300,
		})
	})

	test('an account that never saved settings takes the local ones', () => {
		const merged = mergeAccountState(state({}), state({ settings: { colorScheme: 'light' } }), 42)
		expect(merged).toMatchObject({ settings: { colorScheme: 'light' }, settingsUpdatedAt: 42 })
	})

	test('keys the winner never set are filled from the other side', () => {
		const merged = mergeAccountState(
			state({ settings: { onboardingDismissed: ['install-pwa'] }, settingsUpdatedAt: 100 }),
			state({ settings: { colorScheme: 'dark' }, settingsUpdatedAt: 200 }),
		)
		expect(merged.settings).toEqual({ colorScheme: 'dark', onboardingDismissed: ['install-pwa'] })
	})
})
