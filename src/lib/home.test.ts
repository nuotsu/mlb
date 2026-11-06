/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import {
	DEFAULT_SIZES,
	HOME_STORAGE_KEY,
	HOME_WIDGETS,
	homeLayoutScript,
	moveId,
	nextSize,
	reorderVisible,
	resolveWidgets,
	sanitizeHome,
	seasonPhase,
	serializeWidgets,
	type HomeWidget,
} from './home'

const defaults = () => resolveWidgets()

describe('sanitizeHome', () => {
	test('keeps known widgets once, with valid sizes and hidden flags', () => {
		expect(
			sanitizeHome({
				widgets: [
					{ id: 'blog', size: 'L', hidden: true, extra: 1 },
					{ id: 'blog', size: 'S' },
					{ id: 'nope' },
					{ id: 'team', size: 'XL', hidden: 'yes' },
					null,
				],
			}),
		).toEqual({ widgets: [{ id: 'blog', size: 'L', hidden: true }, { id: 'team' }] })
	})

	test('drops sizes that match the default', () => {
		expect(sanitizeHome({ widgets: [{ id: 'today', size: DEFAULT_SIZES.today }] })).toEqual({
			widgets: [{ id: 'today' }],
		})
	})

	test('an empty list is a valid layout (the defaults); anything else is not', () => {
		expect(sanitizeHome({ widgets: [] })).toEqual({ widgets: [] })
		for (const input of [null, 1, 'x', {}, { widgets: 'blog' }]) {
			expect(sanitizeHome(input)).toBeUndefined()
		}
	})
})

describe('resolveWidgets', () => {
	test('defaults to every widget, in order, at its default size', () => {
		expect(defaults().map((w) => w.id)).toEqual([...HOME_WIDGETS])
		expect(defaults().every((w) => w.size === DEFAULT_SIZES[w.id] && !w.hidden)).toBe(true)
	})

	test('follows the saved order and appends widgets it does not know about', () => {
		const widgets = resolveWidgets([
			{ id: 'season', size: 'M' },
			{ id: 'today', hidden: true },
		])
		expect(widgets.slice(0, 2)).toEqual([
			{ id: 'season', size: 'M', hidden: false },
			{ id: 'today', size: 'W', hidden: true },
		])
		expect(widgets.map((w) => w.id).sort()).toEqual([...HOME_WIDGETS].sort())
	})
})

describe('serializeWidgets', () => {
	test('round-trips through resolveWidgets, saving only what differs', () => {
		const widgets = defaults()
		widgets[1] = { ...widgets[1], size: 'S', hidden: true }
		const saved = serializeWidgets(widgets)
		expect(saved[0]).toEqual({ id: 'today' })
		expect(saved[1]).toEqual({ id: widgets[1].id, size: 'S', hidden: true })
		expect(resolveWidgets(saved)).toEqual(widgets)
	})
})

describe('moveId', () => {
	test('moves an id to an index, clamped', () => {
		expect(moveId(['a', 'b', 'c', 'd'], 'a', 2)).toEqual(['b', 'c', 'a', 'd'])
		expect(moveId(['a', 'b', 'c', 'd'], 'd', 0)).toEqual(['d', 'a', 'b', 'c'])
		expect(moveId(['a', 'b', 'c'], 'b', 99)).toEqual(['a', 'c', 'b'])
		expect(moveId(['a', 'b'], 'z', 0)).toEqual(['a', 'b'])
	})
})

describe('reorderVisible', () => {
	test('reorders visible widgets around hidden ones, which keep their place', () => {
		const w = (id: HomeWidget['id'], hidden = false): HomeWidget => ({ id, size: 'S', hidden })
		const widgets = [w('today'), w('team', true), w('blog'), w('season')]
		expect(reorderVisible(widgets, ['season', 'today', 'blog']).map((x) => x.id)).toEqual([
			'season',
			'team',
			'today',
			'blog',
		])
		// Ids it doesn't know, or hidden ones, are ignored; visible ones it misses go last
		expect(reorderVisible(widgets, ['blog', 'team']).map((x) => x.id)).toEqual([
			'blog',
			'team',
			'today',
			'season',
		])
	})
})

describe('nextSize', () => {
	test('cycles S → M → L → W → S', () => {
		expect(['S', 'M', 'L', 'W'].map((s) => nextSize(s as 'S'))).toEqual(['M', 'L', 'W', 'S'])
	})
})

describe('seasonPhase', () => {
	const season = {
		springStartDate: '2027-02-19',
		regularSeasonStartDate: '2027-03-25',
		postSeasonStartDate: '2027-09-27',
		postSeasonEndDate: '2027-10-31',
	}

	test('follows the season dates', () => {
		expect(seasonPhase(season, '2027-01-10')).toBe('offseason')
		expect(seasonPhase(season, '2027-02-19')).toBe('spring')
		expect(seasonPhase(season, '2027-03-25')).toBe('regular')
		expect(seasonPhase(season, '2027-10-01')).toBe('postseason')
		expect(seasonPhase(season, '2027-11-05')).toBe('offseason')
	})

	test('no season dates is the offseason', () => {
		expect(seasonPhase(null, '2027-06-01')).toBe('offseason')
	})
})

describe('homeLayoutScript', () => {
	function run(saved: unknown) {
		let style: { id: string; textContent: string } | undefined
		const localStorage = {
			getItem: (key: string) =>
				key === HOME_STORAGE_KEY && saved !== undefined ? JSON.stringify(saved) : null,
		}
		const document = {
			createElement: () => ({ id: '', textContent: '' }),
			head: { append: (el: typeof style) => (style = el) },
		}
		new Function('localStorage', 'document', homeLayoutScript())(localStorage, document)
		return style
	}

	test('writes order, spans, and hidden widgets for a saved layout', () => {
		const style = run({
			widgets: [
				{ id: 'blog', size: 'L' },
				{ id: 'today', hidden: true },
			],
		})
		expect(style?.id).toBe('home-layout')
		expect(style?.textContent).toStartWith(
			'[data-home-widget="blog"]{order:0!important;--w:2!important;--h:2!important}' +
				'[data-home-widget="today"]{order:1!important;--w:4!important;--h:1!important;display:none!important}',
		)
		// Everything else follows, at its default size
		expect(style?.textContent).toContain('[data-home-widget="team"]{order:2!important;--w:2')
	})

	test('adds nothing for the defaults or unreadable storage', () => {
		expect(run(undefined)).toBeUndefined()
		expect(run({ widgets: [] })).toBeUndefined()
		expect(run('nope')).toBeUndefined()
	})
})
