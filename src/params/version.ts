import type { ParamMatcher } from '@sveltejs/kit'

export const match: ParamMatcher = (param: string) => {
	return param.match(/^v[0-9.]+$/) !== null
}
