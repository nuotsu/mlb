/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import extras from './fixtures/scorecard-824624.json'
import alds from './fixtures/scorecard-849832.json'
import { buildScorecard, isPlateAppearance, notation, type LineupEntry } from './scorecard'

type RunnerInit = {
	id: number
	start?: string | null
	end?: string | null
	out?: number
	credits?: [credit: string, position: string][]
}

function runner({ id, start = null, end = null, out, credits = [] }: RunnerInit): MLB.Runner {
	return {
		movement: { start, end, isOut: out != null, outNumber: out },
		details: { event: '', eventType: '', runner: { id } as MLB.Person },
		credits: credits.map(([credit, code]) => ({
			credit,
			position: { code } as MLB.Position,
			player: {} as MLB.Person,
		})),
	}
}

let atBatIndex = 0

function play({
	batter = 1,
	eventType,
	event = '',
	description = '',
	rbi = 0,
	inning = 1,
	half = 'top',
	outs = 0,
	runners,
	playEvents = [],
	isComplete = true,
}: {
	batter?: number
	eventType: string
	event?: string
	description?: string
	rbi?: number
	inning?: number
	half?: 'top' | 'bottom'
	outs?: number
	runners?: MLB.Runner[]
	playEvents?: MLB.PlayEvent[]
	isComplete?: boolean
}): MLB.Play {
	return {
		result: { type: 'atBat', event, eventType, description, rbi },
		about: {
			atBatIndex: atBatIndex++,
			halfInning: half,
			isTopInning: half === 'top',
			inning,
			isComplete,
		},
		count: { balls: 0, strikes: 0, outs },
		matchup: { batter: { id: batter } } as MLB.Matchup,
		runners: runners ?? [runner({ id: batter, end: '1B' })],
		playEvents,
	}
}

function pitch(code: string): MLB.PlayEvent {
	return { isPitch: true, details: { code } as MLB.PitchDetails }
}

describe('notation', () => {
	test('hits', () => {
		expect(notation(play({ eventType: 'single' }))).toEqual({ label: '1B', kind: 'hit', bases: 1 })
		expect(notation(play({ eventType: 'double' }))).toEqual({ label: '2B', kind: 'hit', bases: 2 })
		expect(notation(play({ eventType: 'triple' }))).toEqual({ label: '3B', kind: 'hit', bases: 3 })
		expect(notation(play({ eventType: 'home_run' }))).toEqual({
			label: 'HR',
			kind: 'homeRun',
			bases: 4,
		})
	})

	test('walks and hit by pitch', () => {
		expect(notation(play({ eventType: 'walk' }))).toEqual({ label: 'BB', kind: 'walk' })
		expect(notation(play({ eventType: 'intent_walk' })).label).toBe('IBB')
		expect(notation(play({ eventType: 'hit_by_pitch' })).label).toBe('HBP')
	})

	test('strikeouts, swinging and called', () => {
		const out = [runner({ id: 1, out: 1, credits: [['f_putout', '2']] })]
		const swinging = play({ eventType: 'strikeout', runners: out, playEvents: [pitch('S')] })
		const called = play({ eventType: 'strikeout', runners: out, playEvents: [pitch('C')] })
		expect(notation(swinging)).toEqual({ label: 'K', kind: 'strikeout', mirrored: false })
		expect(notation(called)).toEqual({ label: 'K', kind: 'strikeout', mirrored: true })
	})

	test('a called strikeout without pitch data reads the description', () => {
		const p = play({ eventType: 'strikeout', description: 'Nolan Arenado called out on strikes.' })
		expect(notation(p).mirrored).toBe(true)
	})

	test('strikeout double play', () => {
		const p = play({ eventType: 'strikeout_double_play', playEvents: [pitch('S')] })
		expect(notation(p)).toMatchObject({ label: 'K', badge: 'DP' })
	})

	test('errors name the fielder', () => {
		const p = play({
			eventType: 'field_error',
			runners: [runner({ id: 1, end: '1B', credits: [['f_fielding_error', '6']] })],
		})
		expect(notation(p)).toEqual({ label: 'E6', kind: 'error' })
	})

	test("fielder's choice and force outs", () => {
		expect(notation(play({ eventType: 'fielders_choice' }))).toEqual({
			label: 'FC',
			kind: 'fieldersChoice',
		})
		expect(notation(play({ eventType: 'force_out' })).label).toBe('FC')
		expect(notation(play({ eventType: 'fielders_choice_out' })).label).toBe('FC')
	})

	test('ground outs list the fielders', () => {
		const p = play({
			eventType: 'field_out',
			event: 'Groundout',
			runners: [
				runner({
					id: 1,
					out: 1,
					credits: [
						['f_assist', '6'],
						['f_putout', '3'],
					],
				}),
			],
		})
		expect(notation(p)).toEqual({ label: '6-3', kind: 'out', badge: undefined })
	})

	test('unassisted ground outs', () => {
		const p = play({
			eventType: 'field_out',
			event: 'Groundout',
			runners: [runner({ id: 1, out: 1, credits: [['f_putout', '3']] })],
		})
		expect(notation(p).label).toBe('3U')
	})

	test('balls caught in the air', () => {
		const caught = (event: string, position: string) =>
			notation(
				play({
					eventType: 'field_out',
					event,
					runners: [runner({ id: 1, out: 1, credits: [['f_putout', position]] })],
				}),
			).label

		expect(caught('Flyout', '8')).toBe('F8')
		expect(caught('Lineout', '6')).toBe('L6')
		expect(caught('Pop Out', '4')).toBe('P4')
		expect(caught('Bunt Pop Out', '1')).toBe('P1')
	})

	test('double plays join each out', () => {
		const p = play({
			eventType: 'grounded_into_double_play',
			runners: [
				runner({
					id: 2,
					start: '1B',
					out: 1,
					credits: [
						['f_assist', '6'],
						['f_putout', '4'],
					],
				}),
				runner({
					id: 1,
					out: 2,
					credits: [
						['f_assist', '4'],
						['f_putout', '3'],
					],
				}),
			],
		})
		expect(notation(p)).toEqual({ label: '6-4-3', kind: 'out', badge: 'DP' })
	})

	test('a line drive double play', () => {
		const p = play({
			eventType: 'double_play',
			description: 'Batter lines into a double play, shortstop to first baseman.',
			runners: [
				runner({ id: 1, out: 1, credits: [['f_putout', '6']] }),
				runner({
					id: 2,
					start: '1B',
					out: 2,
					credits: [
						['f_assist', '6'],
						['f_putout', '3'],
					],
				}),
			],
		})
		expect(notation(p)).toEqual({ label: 'L6-3', kind: 'out', badge: 'DP' })
	})

	test('a runner caught stealing earlier in the at-bat stays off the batter’s out', () => {
		const p = play({
			eventType: 'field_out',
			event: 'Flyout',
			runners: [
				runner({
					id: 2,
					start: '1B',
					out: 1,
					credits: [
						['f_assist', '2'],
						['f_putout', '6'],
					],
				}),
				runner({ id: 1, out: 2, credits: [['f_putout', '7']] }),
			],
		})
		expect(notation(p).label).toBe('F7')
	})

	test('triple plays', () => {
		const p = play({
			eventType: 'triple_play',
			runners: [
				runner({ id: 3, start: '2B', out: 1, credits: [['f_putout', '5']] }),
				runner({
					id: 2,
					start: '1B',
					out: 2,
					credits: [
						['f_assist', '5'],
						['f_putout', '4'],
					],
				}),
				runner({
					id: 1,
					out: 3,
					credits: [
						['f_assist', '4'],
						['f_putout', '3'],
					],
				}),
			],
		})
		expect(notation(p)).toEqual({ label: '5-4-3', kind: 'out', badge: 'TP' })
	})

	test('sacrifices', () => {
		const out = [runner({ id: 1, out: 1, credits: [['f_putout', '9']] })]
		expect(notation(play({ eventType: 'sac_fly', runners: out }))).toMatchObject({
			label: 'SF',
			kind: 'out',
		})
		expect(notation(play({ eventType: 'sac_bunt', runners: out })).label).toBe('SAC')
	})

	test('unknown events fall back to a short name', () => {
		expect(notation(play({ eventType: 'catcher_interf' })).label).toBe('CI')
		expect(
			notation(play({ eventType: 'batter_interference', event: 'Batter Interference' })),
		).toMatchObject({ label: 'BI' })
		expect(notation(play({ eventType: 'other_out', event: 'Out' })).label).toBe('Out')
	})
})

describe('isPlateAppearance', () => {
	test('an inning that ends on a caught stealing is not the batter’s plate appearance', () => {
		const p = play({
			eventType: 'caught_stealing_2b',
			runners: [runner({ id: 2, start: '1B', out: 3 })],
		})
		expect(isPlateAppearance(p)).toBe(false)
	})

	test('an at-bat in progress is not one yet', () => {
		expect(isPlateAppearance(play({ eventType: 'single', isComplete: false }))).toBe(false)
	})
})

describe('buildScorecard', () => {
	const lineup: LineupEntry[] = Array.from({ length: 9 }, (_, i) => ({
		playerId: i + 1,
		battingOrder: `${i + 1}00`,
	}))

	test('one row per lineup spot and one column per inning', () => {
		const card = buildScorecard({ side: 'away', lineup, plays: [] })
		expect(card.rows.map((r) => r.slot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
		expect(card.innings.map((i) => i.inning)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
		expect(card.innings.every((i) => i.columns === 1 && !i.totals)).toBe(true)
	})

	test('substitutes sit under the player they replaced, with the inning they came in', () => {
		const card = buildScorecard({
			side: 'away',
			lineup: [...lineup, { playerId: 20, battingOrder: '201' }],
			plays: [
				play({
					batter: 20,
					eventType: 'single',
					inning: 5,
					playEvents: [
						{
							type: 'action',
							player: { id: 20 } as MLB.Person,
							details: { eventType: 'offensive_substitution' } as MLB.PitchDetails,
						},
					],
				}),
			],
		})
		expect(card.rows.map((r) => r.playerId).slice(0, 3)).toEqual([1, 2, 20])
		expect(card.rows[2]).toMatchObject({ slot: 2, isSubstitute: true, enteredInning: 5 })
		expect(card.rows[2].cells[0]).toMatchObject({ inning: 5, column: 0, label: '1B' })
	})

	test('batting around adds a column, shared by a pinch hitter in the same spot', () => {
		const plays = [
			...lineup.map(({ playerId }) => play({ batter: playerId, eventType: 'walk', inning: 2 })),
			play({ batter: 21, eventType: 'single', inning: 2 }),
		]
		const card = buildScorecard({
			side: 'away',
			lineup: [...lineup, { playerId: 21, battingOrder: '101' }],
			plays,
		})
		expect(card.innings[1].columns).toBe(2)
		expect(card.rows.find((r) => r.playerId === 1)!.cells[0].column).toBe(0)
		expect(card.rows.find((r) => r.playerId === 21)!.cells[0].column).toBe(1)
	})

	test('a run fills the diamond of the plate appearance it came from, even with a pinch runner', () => {
		const card = buildScorecard({
			side: 'away',
			lineup: [...lineup, { playerId: 30, battingOrder: '101' }],
			plays: [
				play({ batter: 1, eventType: 'double', runners: [runner({ id: 1, end: '2B' })] }),
				play({
					batter: 2,
					eventType: 'single',
					rbi: 1,
					runners: [runner({ id: 2, end: '1B' }), runner({ id: 30, start: '2B', end: 'score' })],
				}),
			],
		})
		const leadoff = card.rows.find((r) => r.playerId === 1)!
		const pinchRunner = card.rows.find((r) => r.playerId === 30)!
		expect(leadoff.cells[0].scored).toBe(true)
		// The double didn't score anyone; the single did
		expect(leadoff.cells[0].isScoringPlay).toBe(false)
		expect(card.rows.find((r) => r.playerId === 2)!.cells[0].isScoringPlay).toBe(true)
		expect(leadoff.totals.r).toBe(0)
		expect(pinchRunner.totals.r).toBe(1)
		expect(card.rows.find((r) => r.playerId === 2)!.totals).toEqual({
			ab: 1,
			r: 0,
			h: 1,
			rbi: 1,
			bb: 0,
			k: 0,
		})
	})

	test('outs on the bases go to the runner’s cell', () => {
		const card = buildScorecard({
			side: 'home',
			lineup,
			plays: [
				play({ batter: 1, half: 'bottom', eventType: 'single' }),
				play({
					batter: 2,
					half: 'bottom',
					eventType: 'grounded_into_double_play',
					outs: 2,
					runners: [
						runner({ id: 1, start: '1B', out: 1, credits: [['f_putout', '4']] }),
						runner({ id: 2, out: 2, credits: [['f_putout', '3']] }),
					],
				}),
			],
		})
		expect(card.rows[0].cells[0].out).toBe(1)
		expect(card.rows[1].cells[0].out).toBe(2)
	})

	test('only counts this side’s half-innings', () => {
		const card = buildScorecard({
			side: 'home',
			lineup,
			plays: [
				play({ batter: 1, eventType: 'home_run', runners: [runner({ id: 1, end: 'score' })] }),
			],
		})
		expect(card.rows.every((r) => r.cells.length === 0)).toBe(true)
	})

	test('runners left on base wait for the half-inning to end', () => {
		const single = (batter: number, outs = 0) =>
			play({ batter, eventType: 'single', outs, runners: [runner({ id: batter, end: '1B' })] })
		const k = (batter: number, outs: number) =>
			play({ batter, eventType: 'strikeout', outs, runners: [runner({ id: batter, out: outs })] })

		const live = buildScorecard({ side: 'away', lineup, plays: [single(1), k(2, 1)] })
		expect(live.innings[0].totals).toEqual({ runs: 0, hits: 1, errors: 0, lob: undefined })

		const over = buildScorecard({
			side: 'away',
			lineup,
			plays: [single(1), k(2, 1), k(3, 2), k(4, 3)],
		})
		expect(over.innings[0].totals).toEqual({ runs: 0, hits: 1, errors: 0, lob: 1 })
	})

	test('extra innings add columns, and the automatic runner gets a cell', () => {
		const card = buildScorecard({
			side: 'away',
			lineup,
			plays: [
				play({
					batter: 4,
					inning: 10,
					eventType: 'single',
					rbi: 1,
					runners: [runner({ id: 4, end: '1B' }), runner({ id: 3, start: '2B', end: 'score' })],
					playEvents: [
						{
							type: 'action',
							player: { id: 3 } as MLB.Person,
							base: 2,
							details: { eventType: 'runner_placed' } as MLB.PitchDetails,
						},
					],
				}),
			],
		})
		expect(card.innings).toHaveLength(10)
		expect(card.rows[2].cells[0]).toMatchObject({ label: 'AR', kind: 'runner', scored: true })
		expect(card.rows[2].totals.r).toBe(1)
		expect(card.innings[9].totals?.runs).toBe(1)
	})
})

/** The scorecard's totals against the official box score and linescore. */
describe.each([
	['849832 (2026 ALDS)', alds],
	['824624 (12 innings, batting around in the 12th)', extras],
])('game %s', (_, game) => {
	const fixture = game as unknown as {
		plays: MLB.Play[]
		boxscore: { teams: Record<'away' | 'home', { players: Record<string, MLB.BoxscorePlayer> }> }
		linescore: MLB.Linescore
	}

	describe.each(['away', 'home'] as const)('%s', (side) => {
		const players = Object.values(fixture.boxscore.teams[side].players)
		const card = buildScorecard({
			plays: fixture.plays,
			side,
			lineup: players.map((p) => ({ playerId: p.person.id, battingOrder: p.battingOrder! })),
			scheduledInnings: fixture.linescore.scheduledInnings,
			isFinal: true,
		})
		const other = side === 'away' ? 'home' : 'away'

		test('innings match the linescore', () => {
			for (const inning of fixture.linescore.innings ?? []) {
				const want = inning[side]
				if (want?.runs == null) continue
				expect({ inning: inning.num, ...card.innings[inning.num - 1].totals }).toEqual({
					inning: inning.num,
					runs: want.runs,
					hits: want.hits!,
					// Errors the other side made while this side batted
					errors: inning[other]!.errors!,
					lob: want.leftOnBase!,
				})
			}
		})

		test('batters match the box score', () => {
			for (const row of card.rows) {
				const stats = fixture.boxscore.teams[side].players[`ID${row.playerId}`].stats!.batting!
				expect({ id: row.playerId, ...row.totals }).toEqual({
					id: row.playerId,
					ab: stats.atBats!,
					r: stats.runs!,
					h: stats.hits!,
					rbi: stats.rbi!,
					bb: stats.baseOnBalls!,
					k: stats.strikeOuts!,
				})
			}
		})
	})
})

test('849832: the order bats around in the top of the 6th', () => {
	const players = Object.values(
		(
			alds as unknown as {
				boxscore: { teams: { away: { players: Record<string, MLB.BoxscorePlayer> } } }
			}
		).boxscore.teams.away.players,
	)
	const card = buildScorecard({
		plays: (alds as unknown as { plays: MLB.Play[] }).plays,
		side: 'away',
		lineup: players.map((p) => ({ playerId: p.person.id, battingOrder: p.battingOrder! })),
		isFinal: true,
	})
	expect(card.innings.map((i) => i.columns)).toEqual([1, 1, 1, 1, 1, 2, 1, 1, 1])
})
