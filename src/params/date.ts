import type { ParamMatcher } from '@sveltejs/kit'

// MLB data starts in 1876; anything past next season is crawler noise.
const MIN_SEASON = 1876

export const match: ParamMatcher = (param: string) => {
	const parts = param.match(/^(\d{4})-(\d{2})-(\d{2})$/)
	if (!parts) return false
	const [year, month, day] = parts.slice(1).map(Number)
	if (year < MIN_SEASON || year > new Date().getFullYear() + 1) return false
	return month >= 1 && month <= 12 && day >= 1 && day <= 31
}
