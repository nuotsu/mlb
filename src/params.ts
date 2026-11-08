import { defineParams } from '@sveltejs/kit/params'

// MLB data starts in 1876; anything past next season is crawler noise.
const MIN_SEASON = 1876

const matchDate = (param: string) => {
	const parts = param.match(/^(\d{4})-(\d{2})-(\d{2})$/)

	if (!parts) return false

	const [year, month, day] = parts.slice(1).map(Number)

	if (year < MIN_SEASON || year > new Date().getFullYear() + 1) return false

	return month >= 1 && month <= 12 && day >= 1 && day <= 31
}

const matchGamePk = (param: string) => {
	return param.match(/^\d+$/) !== null
}

/** npb.jp's `mmdd` in /scores/{season}/{mmdd}/{code}/ */
const matchNpbDate = (param: string) => {
	const parts = param.match(/^(\d{2})(\d{2})$/)
	if (!parts) return false

	const [month, day] = parts.slice(1).map(Number)
	return month >= 1 && month <= 12 && day >= 1 && day <= 31
}

/**
 * npb.jp's team page codes. Kept here rather than imported from `#lib/npb-roster.js`
 * (`NPB_TEAM_INFO`): Node loads this file at build time, outside Vite, so it can't import
 * TypeScript modules. `npb-game.test.ts` checks that the two lists match.
 */
export const NPB_TEAM_CODES = ['g', 't', 'd', 'c', 's', 'db', 'h', 'f', 'b', 'e', 'l', 'm']

/** The All-Star Game's sides, `cl-pl-01`; kept in step with `NPB_ALL_STAR_TEAMS` the same way */
export const NPB_ALL_STAR_CODES = ['cl', 'pl']

/** npb.jp's `{home}-{away}-{nn}` game code, e.g. `t-g-25`: two teams, or the two All-Star sides */
export const matchNpbGame = (param: string) => {
	const parts = param.match(/^([a-z]{1,2})-([a-z]{1,2})-(\d{1,2})$/)
	return (
		!!parts &&
		parts[1] !== parts[2] &&
		[NPB_TEAM_CODES, NPB_ALL_STAR_CODES].some(
			(codes) => codes.includes(parts[1]) && codes.includes(parts[2]),
		)
	)
}

/**
 * koreabaseball.com's team codes, as in its game IDs. Kept here rather than imported from
 * `#lib/kbo.js` (`KBO_TEAMS`), for the same reason as `NPB_TEAM_CODES`; `kbo-game.test.ts` checks
 * that the two lists match.
 */
export const KBO_TEAM_CODES = ['HT', 'SS', 'LG', 'OB', 'KT', 'SK', 'LT', 'HH', 'NC', 'WO']

/** The All-Star Game's sides, 나눔 and 드림; kept in step with `KBO_ALL_STAR_TEAMS` the same way */
export const KBO_ALL_STAR_CODES = ['WE', 'EA']

/** koreabaseball.com's game ID, `{yyyymmdd}{away}{home}{n}`, e.g. `20261001NCOB0` */
export const matchKboGame = (param: string) => {
	const parts = param.match(/^\d{4}(\d{2})(\d{2})([A-Z]{2})([A-Z]{2})\d$/)
	if (!parts) return false

	const [month, day] = [Number(parts[1]), Number(parts[2])]
	return (
		month >= 1 &&
		month <= 12 &&
		day >= 1 &&
		day <= 31 &&
		parts[3] !== parts[4] &&
		[KBO_TEAM_CODES, KBO_ALL_STAR_CODES].some(
			(codes) => codes.includes(parts[3]) && codes.includes(parts[4]),
		)
	)
}

const matchPersonId = (param: string) => {
	return param.match(/^\d+$/) !== null
}

const matchSeason = (param: string) => {
	if (param.match(/^\d{4}$/) === null) return false

	const year = Number(param)

	return year >= MIN_SEASON && year <= new Date().getFullYear() + 1
}

const matchTeamId = (param: string) => {
	return param.match(/^\d+$/) !== null
}

const matchVersion = (param: string) => {
	return param.match(/^v[0-9.]+$/) !== null
}

export const params = defineParams({
	date: (param) => (matchDate(param) ? param : undefined),
	gamePk: (param) => (matchGamePk(param) ? param : undefined),
	kboGame: (param) => (matchKboGame(param) ? param : undefined),
	npbDate: (param) => (matchNpbDate(param) ? param : undefined),
	npbGame: (param) => (matchNpbGame(param) ? param : undefined),
	personId: (param) => (matchPersonId(param) ? param : undefined),
	season: (param) => (matchSeason(param) ? param : undefined),
	teamId: (param) => (matchTeamId(param) ? param : undefined),
	version: (param) => (matchVersion(param) ? param : undefined),
})
