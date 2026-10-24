/** Asset codes a batter is drawn from, per team, bottom layer first. */
export type BatterUniforms = Partial<Record<'home' | 'away', string[]>>

/** Pants under the jersey; caps have no batter render. */
const LAYERS = ['P', 'J']

export function batterUniforms(response: MLB.UniformsResponse | null, gamePk: number) {
	const game = response?.uniforms?.find((u) => u.gamePk === gamePk)
	if (!game) return null

	const codes = (team?: MLB.TeamUniform) => {
		const assets = team?.uniformAssets ?? []
		const layers = LAYERS.map(
			(type) =>
				assets.find((a) => a.uniformAssetType?.uniformAssetTypeCode === type)?.uniformAssetCode,
		)
		return layers.every(Boolean) ? (layers as string[]) : undefined
	}

	return { home: codes(game.home), away: codes(game.away) } satisfies BatterUniforms
}

/**
 * The same uniform with the team's base jersey for its side: `jersey_1` at
 * home, `jersey_2` on the road. Gameday renders those for every team, so they
 * stand in for a jersey it has no render of. `null` if it's already the base.
 */
export function withBaseJersey(codes: string[], side: 'home' | 'away') {
	const base = (code: string) =>
		code.replace(/_jersey_\d+_(\d{4})$/, `_jersey_${side === 'home' ? 1 : 2}_$1`)
	const swapped = codes.map(base)
	return swapped.some((code, i) => code !== codes[i]) ? swapped : null
}

/** The season a uniform's assets are drawn for: the code's suffix. */
export function uniformSeason(code?: string) {
	const year = code?.match(/_(\d{4})$/)?.[1]
	return year ? Number(year) : null
}

/** Gameday's batter render of one uniform piece. */
export function batterUniformSrc(code: string, batSide: 'L' | 'R') {
	const year = uniformSeason(code)
	if (!year) return null
	return `https://prod-gameday.mlbstatic.com/responsive-gameday-assets/1.3.0/images/batters/${year}/${batSide === 'L' ? 'left' : 'right'}/${encodeURIComponent(code)}.png`
}
