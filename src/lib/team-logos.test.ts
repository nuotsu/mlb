/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import { teamLogoSources, usesNpbLogo } from './team-logos'

describe('teamLogoSources', () => {
	const year = new Date().getFullYear()

	test('NPB teams try npb.jp first, then the Stats API cap and spot', () => {
		expect(teamLogoSources(241)).toEqual([
			`https://p.npb.jp/img/common/logo/${year}/logo_g_l.gif`,
			`https://p.npb.jp/img/common/logo/${year - 1}/logo_g_l.gif`,
			'https://www.mlbstatic.com/team-logos/team-cap-on-light/241.svg',
			'https://midfield.mlbstatic.com/v1/team/241/spots/72',
		])
	})

	test('MLB teams use the Stats API cap, then the spot', () => {
		expect(teamLogoSources(147, 'dark')).toEqual([
			'https://www.mlbstatic.com/team-logos/team-cap-on-dark/147.svg',
			'https://midfield.mlbstatic.com/v1/team/147/spots/72',
		])
	})
})

test('usesNpbLogo covers every NPB team, Giants and Tigers included', () => {
	expect(usesNpbLogo(241)).toBe(true)
	expect(usesNpbLogo(341)).toBe(true)
	expect(usesNpbLogo(2798)).toBe(true)
	expect(usesNpbLogo(147)).toBe(false)
})
