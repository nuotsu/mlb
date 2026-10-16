/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import { lastGameDate, parseTeamSeason, teamSeasonSearchParams, withSearch } from './season'

const TODAY = '2026-10-16'
const parse = (search: string) => parseTeamSeason(new URLSearchParams(search), TODAY)

describe('parseTeamSeason', () => {
	test('defaults to the current season with no date', () => {
		expect(parse('')).toEqual({ season: 2026, date: null })
	})

	test('keeps a past season and a date inside it', () => {
		expect(parse('season=2024&date=2024-09-29')).toEqual({ season: 2024, date: '2024-09-29' })
	})

	test('drops a date from another season', () => {
		expect(parse('season=2024&date=2023-09-29')).toEqual({ season: 2024, date: null })
	})

	test('reads the season off the date when only the date is given', () => {
		expect(parse('date=2019-07-04')).toEqual({ season: 2019, date: '2019-07-04' })
	})

	test('falls back to the current season when out of range or malformed', () => {
		expect(parse('season=2030').season).toBe(2026)
		expect(parse('season=1800').season).toBe(2026)
		expect(parse('season=abc').season).toBe(2026)
	})

	test('drops future and impossible dates', () => {
		expect(parse('date=2026-10-17').date).toBeNull()
		expect(parse('season=2024&date=2024-02-30').date).toBeNull()
		expect(parse('season=2024&date=2024-9-1').date).toBeNull()
	})
})

describe('teamSeasonSearchParams', () => {
	const build = (season: number, date?: string | null, base = '') =>
		withSearch(
			'/teams/119',
			teamSeasonSearchParams(new URLSearchParams(base), { season, date }, TODAY),
		)

	test('keeps the URL bare for the current season as of today', () => {
		expect(build(2026)).toBe('/teams/119')
		expect(build(2026, TODAY, 'season=2024&date=2024-09-29')).toBe('/teams/119')
	})

	test('pins a past season, with or without a date', () => {
		expect(build(2024)).toBe('/teams/119?season=2024')
		expect(build(2024, '2024-09-29')).toBe('/teams/119?season=2024&date=2024-09-29')
	})

	test('pins an earlier day of the current season', () => {
		expect(build(2026, '2026-06-01')).toBe('/teams/119?season=2026&date=2026-06-01')
	})

	test('keeps unrelated params and replaces a stale date', () => {
		expect(build(2023, null, 'foo=bar&season=2024&date=2024-09-29')).toBe(
			'/teams/119?foo=bar&season=2023',
		)
	})
})

describe('lastGameDate', () => {
	const day = (date: string, ...states: string[]) =>
		({
			date,
			games: states.map((detailedState) => ({
				status: {
					detailedState,
					abstractGameState: detailedState === 'Final' ? 'Final' : 'Preview',
				},
			})),
		}) as unknown as MLB.ScheduleDate

	test('is the last day with a game played', () => {
		expect(lastGameDate({ dates: [day('2024-09-29', 'Final'), day('2024-10-30', 'Final')] })).toBe(
			'2024-10-30',
		)
	})

	test('skips days whose only game was postponed or cancelled', () => {
		expect(
			lastGameDate({
				dates: [day('2024-09-28', 'Final'), day('2024-09-29', 'Postponed')],
			}),
		).toBe('2024-09-28')
	})

	test('is undefined without games', () => {
		expect(lastGameDate({ dates: [] })).toBeUndefined()
		expect(lastGameDate(undefined)).toBeUndefined()
	})
})
