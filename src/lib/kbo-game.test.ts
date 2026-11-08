/// <reference types="bun" />

import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'
import { KBO_ALL_STAR_CODES, KBO_TEAM_CODES, matchKboGame } from '../params'
import { KBO_ALL_STAR_TEAMS, KBO_TEAMS } from './kbo'
import {
	kboGameCenterUrl,
	kboGamePath,
	kboNotation,
	kboPlays,
	kboScorecard,
	parseKboBoxScore,
	parseKboGameId,
	parseKboGameList,
	parseKboHomeRuns,
	parseKboScoreboard,
	toInningsPitched,
	translateNote,
	translatePositions,
	translateResult,
} from './kbo-game'
import { kboGamePk, toMlbLinescore } from './kbo-game-mlb'

const json = (name: string) =>
	JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))

const box = parseKboBoxScore(json('kbo-boxscore-20261001NCOB0'))!
const ksBox = parseKboBoxScore(json('kbo-boxscore-20261107KTSS0'))!

describe('game IDs', () => {
	test('reads the date, teams and doubleheader number', () => {
		expect(parseKboGameId('20261001NCOB0')).toEqual({
			season: 2026,
			date: '2026-10-01',
			away: 'NC',
			home: 'OB',
			number: 0,
		})
		expect(parseKboGameId('20260711WEEA0')?.away).toBe('WE')
		expect(parseKboGameId('20261001NCNC0')).toBeNull()
		expect(parseKboGameId('20261001XXOB0')).toBeNull()
		expect(kboGamePath('20261001NCOB0')).toBe('/game/kbo/20261001NCOB0')
		expect(kboGameCenterUrl('20261001NCOB0')).toContain('gameDate=20261001&gameId=20261001NCOB0')
	})

	test('the route matcher takes KBO game IDs alone', () => {
		for (const id of ['20261001NCOB0', '20260711WEEA0', '20260801LGSK2']) {
			expect(matchKboGame(id)).toBe(true)
		}
		for (const id of ['20261001NCNC0', '20261301NCOB0', '20261001WEOB0', '2026101NCOB0']) {
			expect(matchKboGame(id)).toBe(false)
		}
	})

	test("the route matcher's team codes match KBO_TEAMS and KBO_ALL_STAR_TEAMS", () => {
		expect([...KBO_TEAM_CODES].sort()).toEqual(
			Object.values(KBO_TEAMS)
				.map((team) => team.code)
				.sort(),
		)
		expect([...KBO_ALL_STAR_CODES].sort()).toEqual(
			Object.values(KBO_ALL_STAR_TEAMS)
				.map((team) => team.code)
				.sort(),
		)
	})

	test('stand-in gamePks are negative, distinct and clear of NPB’s', () => {
		const pks = ['20261001NCOB0', '20261001OBNC0', '20261001NCOB1', '20261002NCOB0'].map(kboGamePk)
		expect(new Set(pks).size).toBe(4)
		for (const pk of pks) expect(pk).toBeLessThan(-1_000_000_000)
	})
})

describe('parseKboGameList', () => {
	test('a finished game: score, starters and decisions with IDs', () => {
		const [game] = parseKboGameList(json('kbo-game-list-20261001'))
		expect(game).toMatchObject({
			id: '20261001NCOB0',
			seriesId: 0,
			competition: 'regular',
			date: '2026-10-01',
			startTime: '18:30',
			venueKo: '잠실',
			state: 'Final',
			isCancelled: false,
			runs: { away: 7, home: 9 },
			gameNumber: 16,
			runners: [],
			count: null,
		})
		expect(game.starters.home).toEqual({ nameKo: '최민석', id: '55268' })
		expect(game.decisions.win).toEqual({ nameKo: '타카다', id: '56212' })
		expect(game.decisions.save?.nameKo).toBe('김택연')
	})

	test('called-off games, with the reason', () => {
		const games = parseKboGameList(json('kbo-game-list-20260722'))
		const cancelled = games.filter((game) => game.isCancelled)
		expect(cancelled.map((game) => [game.id, game.cancelReasonKo])).toEqual([
			['20260722NCLG0', '우천취소'],
			['20260722OBKT0', '그라운드사정'],
		])
		for (const game of cancelled) {
			expect(game.state).toBe('Final')
			expect(game.runs).toEqual({ away: null, home: null })
		}
	})

	test('postseason and All-Star series, and a game not started', () => {
		const [ks4] = parseKboGameList(json('kbo-game-list-20261107'))
		expect(ks4).toMatchObject({ competition: 'korean-series', seriesId: 7, gameNumber: 4 })

		const [ks5] = parseKboGameList(json('kbo-game-list-20261108'))
		expect(ks5).toMatchObject({ state: 'Preview', runs: { away: null, home: null } })
		expect(ks5.decisions).toEqual({ win: null, loss: null, save: null })
		expect(ks5.starters.away?.nameKo).toBe('대니엘')

		const [allStar] = parseKboGameList(json('kbo-game-list-20260711'))
		expect(allStar).toMatchObject({ id: '20260711WEEA0', competition: 'all-star' })
	})

	test('a live game: inning, count and runners', () => {
		const [item] = json('kbo-game-list-20261001').game
		const [live] = parseKboGameList({
			game: [
				{
					...item,
					GAME_STATE_SC: '2',
					GAME_INN_NO: 7,
					GAME_TB_SC: 'B',
					BALL_CN: 2,
					STRIKE_CN: 1,
					OUT_CN: 1,
					B1_BAT_ORDER_NO: 4,
					B2_BAT_ORDER_NO: 0,
					B3_BAT_ORDER_NO: 3,
				},
			],
		})
		expect(live).toMatchObject({
			state: 'Live',
			currentInning: { num: 7, half: 'bottom' },
			count: { balls: 2, strikes: 1, outs: 1 },
			runners: [1, 3],
		})
		expect(live.decisions.win).toBeNull()

		const linescore = toMlbLinescore({ innings: [], teams: { away: {}, home: {} }, summary: live })
		expect(linescore).toMatchObject({ currentInning: 7, inningState: 'Bottom', outs: 1 })
		expect(linescore.offense?.first).toBeDefined()
		expect(linescore.offense?.second).toBeUndefined()
	})
})

describe('parseKboScoreboard', () => {
	test('innings, totals, records and game info', () => {
		const scoreboard = parseKboScoreboard(json('kbo-scoreboard-20261001NCOB0'))
		expect(scoreboard.innings).toHaveLength(9)
		expect(scoreboard.innings[0]).toEqual({ num: 1, away: 0, home: 2 })
		// The home team didn't bat in the ninth
		expect(scoreboard.innings[8]).toEqual({ num: 9, away: 0, home: null })
		expect(scoreboard.teams).toEqual({
			away: { runs: 7, hits: 14, errors: 2, walks: 3 },
			home: { runs: 9, hits: 13, errors: 2, walks: 6 },
		})
		expect(scoreboard.records.home).toEqual({ wins: 70, losses: 63, ties: 5 })
		expect(scoreboard).toMatchObject({
			attendance: 23248,
			startTime: '18:30',
			endTime: '21:54',
			duration: 204,
			venueKo: '잠실',
		})
	})

	test('in the postseason, the records are the round’s', () => {
		const scoreboard = parseKboScoreboard(json('kbo-scoreboard-20261107KTSS0'))
		expect(scoreboard.records).toEqual({
			away: { wins: 1, losses: 3, ties: 0 },
			home: { wins: 3, losses: 1, ties: 0 },
		})
	})

	test('before the game, only the records', () => {
		const scoreboard = parseKboScoreboard(json('kbo-scoreboard-20261108KTSS0'))
		expect(scoreboard.innings).toEqual([])
		expect(scoreboard.teams.away.runs).toBeNull()
		expect(scoreboard.attendance).toBeNull()
		expect(scoreboard.records.home).toEqual({ wins: 3, losses: 1, ties: 0 })
	})

	test('the game page’s linescore', () => {
		const scoreboard = parseKboScoreboard(json('kbo-scoreboard-20261001NCOB0'))
		const linescore = toMlbLinescore({ innings: scoreboard.innings, teams: scoreboard.teams })
		expect(linescore.currentInning).toBe(9)
		expect(linescore.innings).toHaveLength(9)
		expect(linescore.innings?.[8].home).toEqual({})
		expect(linescore.teams?.away).toEqual({ runs: 7, hits: 14, errors: 2 })
	})
})

describe('parseKboBoxScore', () => {
	test('batters: order, substitutes, positions, results and line', () => {
		const [first, second, sub] = box.teams.away.batters
		expect(first).toMatchObject({
			player: { nameKo: '김주원', id: null },
			order: 1,
			substitute: false,
			positionsKo: ['유'],
			atBats: 5,
			hits: 0,
			rbi: 0,
			runs: 0,
			avg: '.285',
		})
		expect(first.innings[0]).toEqual(['삼진'])
		expect(second.order).toBe(2)
		expect(sub).toMatchObject({ order: 2, substitute: true, player: { nameKo: '박시원' } })
		expect(box.innings).toBe(9)
	})

	test('two plate appearances in an inning', () => {
		const batters = [...ksBox.teams.away.batters, ...ksBox.teams.home.batters]
		expect(batters.some((line) => line.innings.some((results) => results.length === 2))).toBe(true)
	})

	test('pitchers: starter, decision, innings and line', () => {
		const [starter] = box.teams.away.pitchers
		expect(starter).toMatchObject({
			player: { nameKo: '송명기' },
			starter: true,
			decision: null,
			inningsPitched: '3.0',
			battersFaced: 17,
			pitches: 66,
			hits: 8,
			homeRuns: 1,
			strikeOuts: 1,
			runs: 6,
			earnedRuns: 6,
			era: '6.25',
		})
		const closer = box.teams.home.pitchers.at(-1)!
		expect(closer).toMatchObject({ decision: 'S', inningsPitched: '1.1', seasonSaves: 4 })
		expect(box.teams.home.pitchers.filter((line) => line.decision === 'H')).toHaveLength(3)
	})

	test('notes, home runs and umpires', () => {
		expect(box.notes.map((note) => note.labelKo)).toContain('결승타')
		expect(parseKboHomeRuns(box)).toEqual([
			{
				side: 'home',
				batter: { nameKo: '양의지', id: null },
				number: 22,
				inning: 1,
				runs: 2,
				pitcher: { nameKo: '송명기', id: null },
			},
		])
		expect(parseKboHomeRuns(ksBox).map((hr) => [hr.batter.nameKo, hr.side, hr.runs])).toEqual([
			['장진혁', 'away', 1],
			['김민혁', 'away', 1],
		])
		expect(box.notes.find((note) => note.labelKo === '심판')?.textKo.split(' ')).toHaveLength(4)
	})

	test('no box score before the game', () => {
		expect(parseKboBoxScore({ code: '200' })).toBeNull()
	})

	test('innings pitched as MLB writes them', () => {
		expect(toInningsPitched('1 2/3')).toBe('1.2')
		expect(toInningsPitched('2/3')).toBe('0.2')
		expect(toInningsPitched('3')).toBe('3.0')
		expect(toInningsPitched('')).toBeNull()
	})
})

describe('plays', () => {
	const plays = kboPlays(box)!

	test('half-innings in order, each picking up the batting order', () => {
		expect(plays.slice(0, 4).map((half) => `${half.inning}${half.half[0]}`)).toEqual([
			'1t',
			'1b',
			'2t',
			'2b',
		])
		const [top1, , top2] = plays
		expect(top1.plays.map((play) => play.batter.nameKo)).toEqual(['김주원', '천재환', '박민우'])
		// The fourth spot leads off the second
		expect(top2.plays[0].batter.nameKo).toBe('김휘집')
	})

	test('batting around', () => {
		const top3 = plays.find((half) => half.inning === 3 && half.half === 'top')!
		expect(top3.plays).toHaveLength(9)
		expect(top3.plays[0].batter.nameKo).toBe('한재환')
	})

	test('scorecard outs count through the half-inning', () => {
		const [leadoff] = kboScorecard(box, 'away')
		expect(leadoff[0][0]).toMatchObject({ label: 'K', kind: 'strikeout', out: 1 })
		const card = kboScorecard(box, 'away')
		const order = box.teams.away.batters
		const third = order.findIndex((line) => line.player.nameKo === '박민우')
		expect(card[third][0][0]).toMatchObject({ label: 'G3', out: 3 })
	})
})

describe('English', () => {
	test('results', () => {
		expect(translateResult('좌중안')).toBe('Single to left-center')
		expect(translateResult('유땅')).toBe('Groundout to shortstop')
		expect(translateResult('유비')).toBe('Popout to shortstop')
		expect(translateResult('중비')).toBe('Flyout to center')
		expect(translateResult('우2')).toBe('Double to right')
		expect(translateResult('좌홈')).toBe('Home run to left')
		expect(translateResult('2병')).toBe('Grounds into a double play to second')
		expect(translateResult('우희비')).toBe('Sacrifice fly to right')
		expect(translateResult('1실')).toBe('Reaches on an error by first')
		expect(translateResult('4구')).toBe('Walk')
		expect(translateResult('고4')).toBe('Intentional walk')
		expect(translateResult('사구')).toBe('Hit by pitch')
		expect(translateResult('삼진')).toBe('Strikeout')
		expect(translateResult('뭔가')).toBe('뭔가')
	})

	test('scorer’s notation', () => {
		expect(kboNotation('좌안')).toEqual({ label: '1B', kind: 'hit', bases: 1 })
		expect(kboNotation('유땅')).toEqual({ label: 'G6', kind: 'out' })
		expect(kboNotation('2병')).toEqual({ label: 'G4', kind: 'out', badge: 'DP' })
		expect(kboNotation('좌중2')).toEqual({ label: '2B', kind: 'hit', bases: 2 })
		expect(kboNotation('삼진')).toEqual({ label: 'K', kind: 'strikeout' })
		expect(kboNotation('뭔가')).toEqual({ label: '뭔가', kind: 'other' })
	})

	test('positions and notes', () => {
		expect(translatePositions(['타', '一'])).toBe('PH-1B')
		expect(translatePositions(['주', '중'])).toBe('PR-CF')
		expect(translateNote('양의지22호(1회2점 송명기)')).toBe('양의지 (22): 1st, 2-run off 송명기')
		expect(translateNote('박찬호3(3 7 9회) 송찬의(7회)')).toBe(
			'박찬호 ×3 (3rd, 7th, 9th) 송찬의 (7th)',
		)
		expect(translateNote('이도윤(4회 2사 1,2루서 우전 안타)')).toBe(
			'이도윤(4th, 2 out, 1,2 on: single to right)',
		)
	})
})
