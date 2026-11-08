/// <reference types="bun" />

import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'
import {
	kboRegisterForm,
	kboRegisterPostback,
	parseBatsThrows,
	parseKboRegister,
} from './kbo-roster'

const html = (name: string) =>
	readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8')

describe('parseKboRegister', () => {
	const roster = parseKboRegister(html('kbo-register-LG-2026'))

	test('the team and day', () => {
		expect(roster.teamId).toBe(2913)
		expect(roster.date).toBe('2026-10-12')
	})

	test('every group, with no registration changes mixed in', () => {
		const count = (group: string) => roster.players.filter((p) => p.group === group).length
		expect(count('manager')).toBe(1)
		expect(count('P')).toBe(16)
		expect(count('C') + count('IF') + count('OF')).toBeGreaterThan(10)
		expect(new Set(roster.players.map((p) => p.id)).size).toBe(roster.players.length)
	})

	test("a player's details", () => {
		const manager = roster.players.find((p) => p.group === 'manager')!
		expect(manager).toMatchObject({
			id: '91350',
			nameKo: '염경엽',
			number: '85',
			throws: 'R',
			bats: 'R',
			birthDate: '1968-03-01',
			heightCm: 178,
			weightKg: 65,
			href: 'https://www.koreabaseball.com/Record/Retire/Hitter.aspx?playerId=91350',
		})
		const pitcher = roster.players.find((p) => p.group === 'P')!
		expect(pitcher.href).toContain('/Record/Player/PitcherDetail/Basic.aspx?playerId=')
		expect(pitcher.photo).toContain(`/person/middle/2026/${pitcher.id}.jpg`)
	})

	test('throws on a page with no register', () => {
		expect(() => parseKboRegister('<html></html>')).toThrow()
	})
})

describe('the register form', () => {
	test('reads the view state and fields a postback needs', () => {
		const form = kboRegisterForm(html('kbo-register-2026'))!
		expect(form.team).toBe('KT')
		expect(form.date).toBe('20261012')
		expect(form.button).toEndWith('$btnCalendarSelect')
		expect(form.viewState.length).toBeGreaterThan(100)

		const body = kboRegisterPostback(form, 'LG')
		expect(body.get(form.teamField)).toBe('LG')
		expect(body.get(form.dateField)).toBe('20261012')
		expect(body.get('__EVENTTARGET')).toBe(form.button)
	})

	test('batting and throwing hands', () => {
		expect(parseBatsThrows('우투좌타')).toEqual({ throws: 'R', bats: 'L' })
		expect(parseBatsThrows('우언우타')).toEqual({ throws: 'R', bats: 'R' })
		expect(parseBatsThrows('좌투양타')).toEqual({ throws: 'L', bats: 'S' })
		expect(parseBatsThrows('')).toEqual({ throws: null, bats: null })
	})
})
