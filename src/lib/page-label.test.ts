import { describe, expect, test } from 'bun:test'
import { pageLabel } from './page-label.ts'

const GAME = '/game/[gamePk=gamePk]'
const TEAM = '/teams/[teamId=teamId]'
const PLAYER = '/player/[personId=personId]'

function game(gameNumber?: number) {
	return {
		game: {
			officialDate: '2027-02-19',
			gameNumber,
			teams: {
				away: { team: { name: 'Chicago White Sox', abbreviation: 'CWS' } },
				home: { team: { name: 'Los Angeles Dodgers', abbreviation: 'LAD' } },
			},
		},
	}
}

describe('pageLabel', () => {
	test('game: away vs home with the official date', () => {
		expect(pageLabel(GAME, game(1))).toBe('CWS vs LAD - 2/19/27')
		expect(pageLabel(GAME, game())).toBe('CWS vs LAD - 2/19/27')
	})

	test('game: the second game of a doubleheader gets (G2)', () => {
		expect(pageLabel(GAME, game(2))).toBe('CWS vs LAD - 2/19/27 (G2)')
	})

	test('team: full name', () => {
		const team = {
			name: 'New York Yankees',
			active: true,
			sport: { id: 1, abbreviation: 'MLB' },
			league: { abbreviation: 'AL' },
		}
		expect(pageLabel(TEAM, { team })).toBe('New York Yankees')
	})

	test('team: a shared name gets the sport, or the league when the sport shares it too', () => {
		// Japan is a team in WBB, 16U, and twice in INT
		expect(
			pageLabel(TEAM, {
				team: { name: 'Japan', sport: { id: 31, abbreviation: 'WBB' }, league: {} },
			}),
		).toBe('Japan (WBB)')
		expect(
			pageLabel(TEAM, {
				team: {
					name: 'Japan',
					sport: { id: 51, abbreviation: 'INT' },
					league: { abbreviation: 'WBC' },
				},
			}),
		).toBe('Japan (WBC)')
	})

	test('team: a current MLB club keeps its plain name over a past team sharing it', () => {
		const angels = { name: 'Los Angeles Angels', league: { abbreviation: 'PCL' } }
		expect(
			pageLabel(TEAM, {
				team: { ...angels, active: true, sport: { id: 1, abbreviation: 'MLB' } },
			}),
		).toBe('Los Angeles Angels')
		expect(
			pageLabel(TEAM, {
				team: { ...angels, active: false, sport: { id: 21, abbreviation: 'Minors' } },
			}),
		).toBe('Los Angeles Angels (Minors)')
	})

	test('player: full name', () => {
		expect(pageLabel(PLAYER, { person: { fullName: 'Thiago Vaccanio' } })).toBe('Thiago Vaccanio')
	})

	test('other routes, and labeled routes without their data, get no label', () => {
		expect(pageLabel('/', {})).toBeUndefined()
		expect(pageLabel('/schedule/day/[date]', game(1))).toBeUndefined()
		expect(pageLabel('/game/kbo/[kboGame=kboGame]', game(1))).toBeUndefined()
		expect(pageLabel(null, {})).toBeUndefined()
		// Error pages keep the route id but have no page data
		expect(pageLabel(GAME, {})).toBeUndefined()
		expect(pageLabel(TEAM, {})).toBeUndefined()
		expect(pageLabel(PLAYER, {})).toBeUndefined()
	})
})
