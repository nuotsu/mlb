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

/** Gameday's batter render of one uniform piece; the season is the code's suffix. */
export function batterUniformSrc(code: string, batSide: 'L' | 'R') {
	const year = code.match(/_(\d{4})$/)?.[1]
	if (!year) return null
	return `https://prod-gameday.mlbstatic.com/responsive-gameday-assets/1.3.0/images/batters/${year}/${batSide === 'L' ? 'left' : 'right'}/${encodeURIComponent(code)}.png`
}
