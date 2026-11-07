/// <reference types="bun" />

import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'
import {
	isNpbGameCode,
	isNpbGameDate,
	npbGamePath,
	npbGameUrl,
	parseNpbBox,
	parseNpbGame,
	parseNpbPlays,
	parseRunners,
	scorebookNotation,
	translatePlay,
	translatePositions,
	translateRecord,
	translateStatus,
	type NpbGameRef,
} from './npb-game'
import { toMlbLinescore } from './npb-game-mlb'

const page = (code: string, name: string) =>
	readFileSync(
		new URL(`./fixtures/npb-game-2026-1001-${code}-${name}.html`, import.meta.url),
		'utf8',
	)

/** A 2-2 tie in 12 innings: no decisions, holds on both sides */
const TIE: NpbGameRef = { season: 2026, date: '1001', code: 't-g-25' }
/** Hiroshima 5-1 over Chunichi in 9, the home 9th not played */
const WIN: NpbGameRef = { season: 2026, date: '1001', code: 'c-d-25' }

describe('references', () => {
	test('match npb.jp dates and game codes', () => {
		expect(isNpbGameDate('1001')).toBe(true)
		expect(isNpbGameDate('1301')).toBe(false)
		expect(isNpbGameDate('101')).toBe(false)
		expect(isNpbGameCode('t-g-25')).toBe(true)
		expect(isNpbGameCode('db-s-3')).toBe(true)
		expect(isNpbGameCode('t-t-25')).toBe(false)
		expect(isNpbGameCode('x-g-25')).toBe(false)
		expect(isNpbGameCode('t-g')).toBe(false)
	})

	test('builds URLs', () => {
		expect(npbGameUrl(TIE)).toBe('https://npb.jp/scores/2026/1001/t-g-25/')
		expect(npbGameUrl(TIE, 'box')).toBe('https://npb.jp/scores/2026/1001/t-g-25/box.html')
		expect(npbGamePath(TIE)).toBe('/game/npb/2026/1001/t-g-25')
	})
})

describe('parseNpbGame', () => {
	const game = parseNpbGame(page('t-g-25', 'index'), TIE)

	test('reads the header', () => {
		expect(game.date).toBe('2026-10-01')
		expect(game.venueJa).toBe('甲子園')
		expect(game.competitionJa).toBe('JERA セ・リーグ公式戦')
		expect(game.seriesGameNumber).toBe(25)
		expect(game.state).toBe('Final')
		expect(game.statusJa).toBe('試合終了')
		expect(game.startTime).toBe('18:00')
		expect(game.endTime).toBe('23:05')
		expect(game.duration).toBe(305)
		expect(game.attendance).toBe(42640)
	})

	test('puts the visitors (top row) away and maps teams', () => {
		expect(game.teams.away).toMatchObject({
			id: 241,
			code: 'g',
			nameJa: '読売ジャイアンツ',
			shortNameJa: '巨人',
			name: 'Yomiuri Giants',
			runs: 2,
			hits: 7,
			errors: 0,
		})
		expect(game.teams.home).toMatchObject({ id: 341, code: 't', runs: 2, hits: 14 })
	})

	test('reads every inning', () => {
		expect(game.innings).toHaveLength(12)
		expect(game.innings[3]).toEqual({ num: 4, away: 1, home: 0 })
		expect(game.innings[5]).toEqual({ num: 6, away: 0, home: 1 })
	})

	test('reads umpires and home runs, and no decisions in a tie', () => {
		expect(game.umpires).toEqual([
			{ position: 'HP', nameJa: '福家' },
			{ position: '1B', nameJa: '嶋田' },
			{ position: '2B', nameJa: '芦原' },
			{ position: '3B', nameJa: '土山' },
		])
		expect(game.homeRuns).toEqual([
			{
				side: 'home',
				batter: { id: '21325134', nameJa: '大山' },
				number: 20,
				inning: 6,
				runnersOn: 0,
				pitcher: { id: '31635159', nameJa: '西舘' },
			},
		])
		expect(game.decisions).toEqual({ win: null, loss: null, save: null })
	})

	test('reads decisions and an unplayed home 9th', () => {
		const win = parseNpbGame(page('c-d-25', 'index'), WIN)
		expect(win.decisions.win).toEqual({
			player: { id: '11415134', nameJa: '床田' },
			recordJa: '8勝6敗',
		})
		expect(win.decisions.loss?.player.nameJa).toBe('大野')
		expect(win.innings.at(-1)).toEqual({ num: 9, away: 0, home: 'X' })
		expect(win.homeRuns.map((hr) => [hr.side, hr.batter.nameJa, hr.runnersOn])).toEqual([
			['away', '細川', 0],
			['home', '中村奨', 1],
			['home', '坂倉', 0],
		])
	})

	test('throws without a linescore', () => {
		expect(() => parseNpbGame('<html></html>', TIE)).toThrow()
	})
})

describe('parseNpbBox', () => {
	const box = parseNpbBox(page('t-g-25', 'box'))

	test('reads starters and substitutes', () => {
		const [first, , , ueda] = box.home.batters
		expect(first).toMatchObject({
			order: 1,
			positionsJa: ['中'],
			player: { id: '71075138', nameJa: '近本' },
			atBats: 4,
			hits: 1,
			stolenBases: 1,
		})
		expect(first.innings[0]).toEqual(['四球'])
		expect(first.innings[2]).toEqual([])
		expect(ueda).toMatchObject({ order: null, positionsJa: ['走'], player: { nameJa: '植田' } })
		expect(box.home.batters.find((b) => b.player.nameJa === '髙寺')?.positionsJa).toEqual([
			'左',
			'右',
		])
	})

	test('reads pitching lines, holds and partial innings', () => {
		expect(box.away.pitchers).toHaveLength(8)
		expect(box.away.pitchers[0]).toMatchObject({
			decision: null,
			player: { nameJa: '竹丸' },
			pitches: 81,
			battersFaced: 22,
			inningsPitched: '5.0',
			hits: 7,
			strikeOuts: 4,
		})
		expect(box.away.pitchers[3]).toMatchObject({ decision: 'H', inningsPitched: '0.2' })
		expect(box.away.pitchers.at(-1)?.inningsPitched).toBe('2.1')
	})

	test('reads wins and losses', () => {
		const win = parseNpbBox(page('c-d-25', 'box'))
		expect(win.away.pitchers[0]).toMatchObject({ decision: 'L', player: { nameJa: '大野' } })
		expect(win.home.pitchers[0]).toMatchObject({ decision: 'W', player: { nameJa: '床田' } })
	})
})

describe('parseNpbPlays', () => {
	const plays = parseNpbPlays(page('t-g-25', 'playbyplay'))

	test('splits half-innings', () => {
		expect(plays).toHaveLength(24)
		expect(plays[0]).toMatchObject({ inning: 1, half: 'top' })
		expect(plays[1]).toMatchObject({ inning: 1, half: 'bottom' })
	})

	test('reads plate appearances and notes', () => {
		const [starter, first] = plays[0].events
		expect(starter).toMatchObject({ type: 'note', textJa: '（先発投手） 村上' })
		expect(first).toEqual({
			type: 'atBat',
			outs: 0,
			runners: [],
			batter: { id: '21425116', nameJa: '丸' },
			count: { balls: 1, strikes: 2 },
			resultJa: '空振り三振',
			rbi: 0,
		})
		expect(plays[1].events.at(-1)).toMatchObject({
			runners: [1, 2, 3],
			resultJa: 'サードゴロ併殺打',
		})
	})

	test('reads runs batted in and steals', () => {
		const events = plays.flatMap((half) => half.events)
		expect(
			events.find((e) => e.type === 'atBat' && e.resultJa.includes('ホームラン')),
		).toMatchObject({
			rbi: 1,
		})
		expect(events.find((e) => e.type === 'note' && e.textJa.includes('盗塁'))).toMatchObject({
			outs: 1,
			runners: [1],
			players: [{ id: '71075138', nameJa: '近本' }],
		})
	})
})

describe('English', () => {
	const names = (player: { nameJa: string }) =>
		({ 近本: 'Chikamoto', 村上: 'Murakami', 木下: 'Kinoshita' })[player.nameJa] ?? player.nameJa

	test('translates plays', () => {
		expect(translatePlay('空振り三振', names)).toBe('Strikeout swinging')
		expect(translatePlay('センター前タイムリーヒット（打点1）', names)).toBe(
			'RBI single to center, 1 RBI',
		)
		expect(translatePlay('左中間ソロホームラン（打点1）', names)).toBe(
			'Solo home run to left-center, 1 RBI',
		)
		expect(translatePlay('ライト線スリーベース', names)).toBe('Triple down the right-field line')
		expect(translatePlay('サードゴロ併殺打', names)).toBe('Grounds into a double play to third')
		expect(translatePlay('ピッチャーゴロ（フィールダースチョイス）', names)).toBe(
			"Groundout to pitcher, fielder's choice",
		)
		expect(translatePlay('謎のプレー', names)).toBe('謎のプレー')
	})

	test('translates notes with English names', () => {
		const players = [
			{ id: '1', nameJa: '近本' },
			{ id: '2', nameJa: '村上' },
			{ id: '3', nameJa: '木下' },
		]
		expect(translatePlay('（走者・近本）二塁盗塁成功', names, players)).toBe('Chikamoto steals 2nd')
		expect(translatePlay('（先発投手） 村上', names, players)).toBe('Starting pitcher: Murakami')
		expect(translatePlay('（投手交代） 村上 → 木下', names, players)).toBe(
			'Pitching change: Murakami → Kinoshita',
		)
	})

	test('translates every result in the fixtures', () => {
		for (const code of ['t-g-25', 'c-d-25']) {
			for (const event of parseNpbPlays(page(code, 'playbyplay')).flatMap((half) => half.events)) {
				const text = event.type === 'atBat' ? event.resultJa : event.textJa
				expect(translatePlay(text, names, event.type === 'note' ? event.players : [])).not.toBe(
					text,
				)
			}
		}
	})

	test('writes scorebook entries in scorer’s notation', () => {
		expect(scorebookNotation('三　振')).toMatchObject({ label: 'K', kind: 'strikeout' })
		expect(scorebookNotation('右前安')).toMatchObject({ label: '1B', kind: 'hit', rbi: 0 })
		expect(scorebookNotation('右線２')).toMatchObject({ label: '2B' })
		expect(scorebookNotation('左中本①')).toMatchObject({ label: 'HR', kind: 'homeRun', rbi: 1 })
		expect(scorebookNotation('二ゴロ')).toMatchObject({ label: 'G4', kind: 'out' })
		expect(scorebookNotation('右　飛')).toMatchObject({ label: 'F9' })
		expect(scorebookNotation('三併打')).toMatchObject({ label: 'G5', badge: 'DP' })
		expect(scorebookNotation('右犠飛①')).toMatchObject({ label: 'SF', rbi: 1 })
		expect(scorebookNotation('敬遠四')).toMatchObject({ label: 'IBB', kind: 'walk' })
		for (const code of ['t-g-25', 'c-d-25']) {
			const box = parseNpbBox(page(code, 'box'))
			for (const entry of [...box.away.batters, ...box.home.batters].flatMap((b) =>
				b.innings.flat(),
			)) {
				expect(scorebookNotation(entry).kind).not.toBe('other')
			}
		}
	})

	test('translates positions, records and statuses', () => {
		expect(translatePositions(['打', '捕'])).toBe('PH-C')
		expect(translateRecord('8勝6敗')).toBe('8-6')
		expect(translateRecord('3勝2敗30S')).toBe('3-2, 30 SV')
		expect(translateStatus('試合終了')).toBe('Final')
		expect(translateStatus('7回裏')).toBe('Bot 7')
		expect(translateStatus('中止')).toBe('Postponed')
		expect(parseRunners('1・3塁')).toEqual([1, 3])
		expect(parseRunners('満塁')).toEqual([1, 2, 3])
	})
})

describe('toMlbLinescore', () => {
	test('shapes innings for the shared linescore', () => {
		const linescore = toMlbLinescore(parseNpbGame(page('c-d-25', 'index'), WIN))
		expect(linescore.innings).toHaveLength(9)
		expect(linescore.innings?.at(-1)).toEqual({ num: 9, away: { runs: 0 }, home: {} } as never)
		expect(linescore.currentInning).toBe(9)
		expect(linescore.teams?.home).toMatchObject({ runs: 5 })
	})
})
