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

/** npb.jp's `{home}-{away}-{nn}` game code, e.g. `t-g-25` */
const matchNpbGame = (param: string) => {
	const parts = param.match(/^([a-z]{1,2})-([a-z]{1,2})-(\d{1,2})$/)
	return (
		!!parts &&
		parts[1] !== parts[2] &&
		NPB_TEAM_CODES.includes(parts[1]) &&
		NPB_TEAM_CODES.includes(parts[2])
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
	npbDate: (param) => (matchNpbDate(param) ? param : undefined),
	npbGame: (param) => (matchNpbGame(param) ? param : undefined),
	personId: (param) => (matchPersonId(param) ? param : undefined),
	season: (param) => (matchSeason(param) ? param : undefined),
	teamId: (param) => (matchTeamId(param) ? param : undefined),
	version: (param) => (matchVersion(param) ? param : undefined),
})
