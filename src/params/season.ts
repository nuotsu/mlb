import type { ParamMatcher } from '@sveltejs/kit'

// MLB data starts in 1876; anything past next season is crawler noise.
const MIN_SEASON = 1876

export const match: ParamMatcher = (param: string) => {
	if (param.match(/^\d{4}$/) === null) return false
	const year = Number(param)
	return year >= MIN_SEASON && year <= new Date().getFullYear() + 1
}
