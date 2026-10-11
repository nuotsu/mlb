/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import extras from './fixtures/scorecard-824624.json'
import alds from './fixtures/scorecard-849832.json'
import {
	absChallenges,
	absChallengeSummary,
	absChallengeText,
	buildScorecard,
	isInGame,
	isPlateAppearance,
	madeOut,
	notation,
	pickoff,
	steal,
	type LineupEntry,
} from './scorecard'

type RunnerInit = {
	id: number
	start?: string | null
	end?: string | null
	out?: number
	credits?: [credit: string, position: string][]
	eventType?: string
	outBase?: string
}

function runner({
	id,
	start = null,
	end = null,
	out,
	credits = [],
	eventType = '',
	outBase,
}: RunnerInit): MLB.Runner {
	return {
		movement: { start, end, outBase, isOut: out != null, outNumber: out },
		details: { event: '', eventType, runner: { id } as MLB.Person },
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
		expect(notation(play({ eventType: 'walk' }))).toEqual({ label: 'BB', kind: 'walk', bases: 1 })
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
		expect(notation(p)).toEqual({ label: 'E6', kind: 'error', bases: 1 })
	})

	test('a throwing error that lets the batter take second', () => {
		const p = play({
			eventType: 'field_error',
			runners: [
				runner({ id: 1, end: '1B', credits: [['f_fielding_error', '6']] }),
				runner({ id: 1, start: '1B', end: '2B', credits: [['f_throwing_error', '6']] }),
			],
		})
		expect(notation(p)).toMatchObject({ label: 'E6', bases: 2 })
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

	test('steals go to the runner’s cell, and only for the runner who tried', () => {
		const card = buildScorecard({
			side: 'home',
			lineup,
			plays: [
				play({ batter: 1, half: 'bottom', eventType: 'single' }),
				play({ batter: 2, half: 'bottom', eventType: 'walk' }),
				play({
					batter: 3,
					half: 'bottom',
					eventType: 'strikeout',
					outs: 2,
					runners: [
						runner({ id: 3, out: 1 }),
						runner({ id: 1, start: '1B', end: '2B', eventType: 'stolen_base_2b' }),
						runner({ id: 1, start: '2B', out: 2, eventType: 'caught_stealing_3b' }),
						// Moved up behind the runner caught stealing
						runner({ id: 2, start: '1B', end: '2B', eventType: 'caught_stealing_3b' }),
					],
				}),
			],
		})
		expect(card.rows[0].cells[0].steals).toEqual([
			{ from: 1, to: 2 },
			{ from: 2, to: 3, caught: 'atBase' },
		])
		expect(card.rows[1].cells[0].steals).toBeUndefined()
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

describe('isInGame', () => {
	function card(side: 'away' | 'home') {
		const fixture = alds as unknown as {
			plays: MLB.Play[]
			boxscore: { teams: Record<'away' | 'home', { players: Record<string, MLB.BoxscorePlayer> }> }
		}
		const players = Object.values(fixture.boxscore.teams[side].players)
		return buildScorecard({
			plays: fixture.plays,
			side,
			lineup: players.map((p) => ({ playerId: p.person.id, battingOrder: p.battingOrder! })),
			isFinal: true,
		})
	}
	const row = (c: ReturnType<typeof card>, id: number) => c.rows.find((r) => r.playerId === id)!

	test('a defensive replacement made in the field starts with the next time up', () => {
		// CLE bats in the top; Halpin replaced Martínez in the bottom of the 7th
		const cle = card('away')
		const martinez = row(cle, 682657)
		const halpin = row(cle, 690984)
		expect(halpin.entered).toEqual({ inning: 7, half: 'bottom' })
		expect(martinez.exited).toEqual({ inning: 7, half: 'bottom' })
		expect([6, 7, 8].map((i) => isInGame(martinez, i, 'away'))).toEqual([true, true, false])
		expect([6, 7, 8].map((i) => isInGame(halpin, i, 'away'))).toEqual([false, false, true])
	})

	test('a pinch hitter counts from the inning they batted in', () => {
		// CWS bats in the bottom; Peters pinch-hit for Grichuk in the bottom of the 5th
		const cws = card('home')
		const grichuk = row(cws, 545341)
		const peters = row(cws, 671976)
		expect([4, 5].map((i) => isInGame(grichuk, i, 'home'))).toEqual([true, false])
		expect([4, 5].map((i) => isInGame(peters, i, 'home'))).toEqual([false, true])
	})

	test('starters who stay in play the whole game', () => {
		const kwan = row(card('away'), 680757)
		expect(kwan.entered).toBeUndefined()
		expect(kwan.exited).toBeUndefined()
		expect([1, 9, 12].every((i) => isInGame(kwan, i, 'away'))).toBe(true)
	})
})

describe('steal', () => {
	const caught = (init: Omit<RunnerInit, 'id'>) => steal(runner({ id: 1, out: 1, ...init }))
	const credits = (...positions: string[]) =>
		positions.map((p, i): [string, string] => [
			i === positions.length - 1 ? 'f_putout' : 'f_assist',
			p,
		])

	test('one throw and a tag at the base', () => {
		expect(
			caught({
				start: '1B',
				outBase: '2B',
				eventType: 'caught_stealing_2b',
				credits: credits('2', '6'),
			}),
		).toEqual({ from: 1, to: 2, caught: 'atBase' })
		expect(
			caught({
				start: '3B',
				outBase: '4B',
				eventType: 'caught_stealing_home',
				credits: credits('1', '2'),
			}),
		).toEqual({ from: 3, to: 4, caught: 'atBase' })
	})

	test('a rundown is caught between bases', () => {
		expect(
			caught({
				start: '1B',
				outBase: '2B',
				eventType: 'caught_stealing_2b',
				credits: credits('2', '3', '4', '3'),
			})?.caught,
		).toBe('between')
	})

	test('picked off and caught stealing counts the pickoff throw', () => {
		const eventType = 'pickoff_caught_stealing_2b'
		expect(
			caught({ start: '1B', outBase: '2B', eventType, credits: credits('1', '3', '4') })?.caught,
		).toBe('atBase')
		expect(
			caught({ start: '1B', outBase: '2B', eventType, credits: credits('1', '3', '4', '1') })
				?.caught,
		).toBe('between')
		// Tagged by the first baseman before getting far
		expect(
			caught({ start: '1B', outBase: '1B', eventType, credits: credits('1', '3') })?.caught,
		).toBe('between')
	})
})

describe('pickoff', () => {
	test('the base a runner was picked off at', () => {
		expect(pickoff(runner({ id: 1, start: '2B', out: 1, eventType: 'pickoff_2b' }))).toBe(2)
	})

	test('a pickoff error leaves them on base', () => {
		expect(pickoff(runner({ id: 1, start: '1B', end: '2B', eventType: 'pickoff_error_1b' }))).toBe(
			undefined,
		)
		expect(
			pickoff(runner({ id: 1, start: '1B', out: 1, eventType: 'pickoff_caught_stealing_2b' })),
		).toBe(undefined)
	})
})

describe('madeOut', () => {
	test('the batter is out', () => {
		expect(madeOut(play({ eventType: 'strikeout', runners: [runner({ id: 1, out: 1 })] }))).toBe(
			true,
		)
	})

	test("a fielder's choice that forces a runner", () => {
		const p = play({
			eventType: 'force_out',
			runners: [runner({ id: 2, start: '1B', out: 1 }), runner({ id: 1, end: '1B' })],
		})
		expect(madeOut(p)).toBe(true)
	})

	test('an error with nobody out', () => {
		const p = play({
			eventType: 'field_error',
			runners: [runner({ id: 1, end: '1B', credits: [['f_fielding_error', '6']] })],
		})
		expect(madeOut(p)).toBe(false)
	})

	test('a strikeout the batter reached on', () => {
		expect(madeOut(play({ eventType: 'strikeout', runners: [runner({ id: 1, end: '1B' })] }))).toBe(
			false,
		)
	})

	test('a runner caught stealing earlier in the at-bat is not the batter’s out', () => {
		const p = play({
			eventType: 'walk',
			runners: [
				{
					...runner({ id: 2, start: '1B', out: 1 }),
					details: { ...runner({ id: 2 }).details, playIndex: 2 },
				},
				{
					...runner({ id: 1, end: '1B' }),
					details: { ...runner({ id: 1 }).details, playIndex: 5 },
				},
			],
		})
		expect(madeOut(p)).toBe(false)
	})
})

describe('absChallenges', () => {
	const BATTER = { id: 1, fullName: 'Sam Antonacci' } as MLB.Person
	const PITCHER = { id: 2, fullName: 'Cade Smith' } as MLB.Person
	const CATCHER = { id: 3, fullName: 'Patrick Bailey' } as MLB.Person

	/** A pitch and the count after it, with an ABS review when `challenger` is set. */
	function abs(
		code: string,
		[balls, strikes]: [number, number],
		review?: { challenger: MLB.Person; overturned: boolean; inProgress?: boolean },
	): MLB.PlayEvent {
		return {
			...pitch(code),
			count: { balls, strikes, outs: 0 },
			reviewDetails: review && {
				reviewType: 'MJ',
				isOverturned: review.overturned,
				inProgress: review.inProgress ?? false,
				player: review.challenger,
			},
		}
	}

	function atBat(playEvents: MLB.PlayEvent[], description = '') {
		const p = play({ eventType: 'field_out', description, playEvents })
		p.matchup = { ...p.matchup, batter: BATTER, pitcher: PITCHER }
		return p
	}

	test('none', () => {
		const p = atBat([abs('B', [1, 0]), abs('C', [1, 1]), abs('X', [1, 1])])
		expect(absChallenges(p)).toEqual([])
		expect(absChallengeSummary(absChallenges(p))).toBe('')
	})

	test('one successful', () => {
		const p = atBat([
			abs('B', [1, 0]),
			// Called a strike, overturned to a ball: the feed already shows the ball
			abs('B', [2, 0], { challenger: BATTER, overturned: true }),
			abs('X', [2, 0]),
		])
		const challenges = absChallenges(p)
		expect(challenges).toEqual([
			{
				overturned: true,
				call: 'strike',
				pitchNumber: 2,
				count: { balls: 1, strikes: 0 },
				challenger: { id: 1, name: 'Sam Antonacci', role: 'batter' },
			},
		])
		expect(absChallengeText(challenges[0])).toBe(
			'ABS challenge (batter Sam Antonacci): strike overturned to ball, successful · pitch 2, 1-0 count',
		)
		expect(absChallengeSummary(challenges)).toBe('1 successful ABS challenge')
	})

	test('one unsuccessful', () => {
		const p = atBat([
			abs('B', [1, 0], { challenger: CATCHER, overturned: false }),
			abs('X', [1, 0]),
		])
		const challenges = absChallenges(p)
		expect(challenges).toEqual([
			{
				overturned: false,
				call: 'ball',
				pitchNumber: 1,
				count: { balls: 0, strikes: 0 },
				challenger: { id: 3, name: 'Patrick Bailey', role: 'catcher' },
			},
		])
		expect(absChallengeText(challenges[0])).toBe(
			'ABS challenge (catcher Patrick Bailey): ball upheld, unsuccessful · pitch 1, 0-0 count',
		)
		expect(absChallengeSummary(challenges)).toBe('1 unsuccessful ABS challenge')
	})

	test('two mixed, by both teams, in pitch order', () => {
		const p = atBat([
			abs('B', [1, 0], { challenger: CATCHER, overturned: false }),
			abs('C', [1, 1], { challenger: PITCHER, overturned: true }),
			abs('X', [1, 1]),
		])
		const challenges = absChallenges(p)
		expect(
			challenges.map((c) => [c.overturned, c.call, c.pitchNumber, c.challenger?.role]),
		).toEqual([
			[false, 'ball', 1, 'catcher'],
			[true, 'ball', 2, 'pitcher'],
		])
		expect(absChallengeSummary(challenges)).toBe('2 ABS challenges: 1 successful, 1 unsuccessful')
	})

	test('a challenge on the last pitch that only the description mentions', () => {
		// 849833, bottom 9: the strikeout pitch was challenged, but only the description says so
		const p = atBat(
			[
				abs('C', [0, 1]),
				abs('B', [1, 1], { challenger: CATCHER, overturned: false }),
				abs('F', [1, 2]),
				abs('C', [1, 3]),
			],
			'Patrick Bailey challenged (pitch result), call on the field was overturned: Sam Antonacci called out on strikes.',
		)
		const challenges = absChallenges(p)
		expect(challenges.map((c) => [c.overturned, c.pitchNumber])).toEqual([
			[false, 2],
			[true, 4],
		])
		expect(absChallengeText(challenges[1])).toBe(
			'ABS challenge (catcher Patrick Bailey): ball overturned to strike, successful · pitch 4, 1-2 count',
		)
	})

	test('the same last-pitch challenge in both places counts once', () => {
		const p = atBat(
			[abs('C', [0, 3], { challenger: CATCHER, overturned: true })],
			'Patrick Bailey challenged (pitch result), call on the field was overturned: Sam Antonacci called out on strikes.',
		)
		expect(absChallenges(p)).toHaveLength(1)
	})

	test('skips play reviews and challenges still under review', () => {
		const p = atBat(
			[
				abs('B', [1, 0], { challenger: CATCHER, overturned: false, inProgress: true }),
				{ ...abs('F', [1, 1]), reviewDetails: { reviewType: 'MI', isOverturned: false } },
				abs('X', [1, 1]),
			],
			'White Sox challenged (catch or drop), call on the field was upheld: Sam Antonacci flies out.',
		)
		expect(absChallenges(p)).toEqual([])
	})

	test("the batter's cell carries them", () => {
		const p = atBat([abs('B', [1, 0], { challenger: BATTER, overturned: true }), abs('X', [1, 0])])
		const card = buildScorecard({
			side: 'away',
			lineup: [{ playerId: 1, battingOrder: '100' }],
			plays: [p],
		})
		expect(card.rows[0].cells[0].absChallenges).toHaveLength(1)
	})
})
