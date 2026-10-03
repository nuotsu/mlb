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
	personId: (param) => (matchPersonId(param) ? param : undefined),
	season: (param) => (matchSeason(param) ? param : undefined),
	teamId: (param) => (matchTeamId(param) ? param : undefined),
	version: (param) => (matchVersion(param) ? param : undefined),
})
