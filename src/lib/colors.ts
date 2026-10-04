export function isDarkOnLightTeam(team?: MLB.Team, sport?: MLB.Sport) {
	if (!team) return false

	return (
		['Asheville Tourists', 'Minnesota Golden Gophers', 'Sultanes de Monterrey'].includes(
			team.name,
		) || [16, 17, 22, 23, 51].includes(sport?.id ?? (team as MLB.TeamDetailed).sport?.id ?? 1)
	)
}

export function isLightOnDarkTeam(team?: MLB.Team) {
	if (!team) return false

	return ['Hanshin Tigers', 'Tokyo Yomiuri Giants'].includes(team.name)
}

/** White → red text color for pitch velocity (mph). Full red at 100+. */
export function pitchSpeedColor(mph: number, min = 70, max = 100) {
	const t = Math.min(1, Math.max(0, (mph - min) / (max - min)))
	return `color-mix(in oklab, var(--color-red-500) ${Math.round(t * 100)}%, white)`
}

/**
 * Red → yellow → green for an umpire's call accuracy, from 75% up to 100%.
 * Darker shades on light backgrounds and lighter ones on dark keep it legible.
 */
export function accuracyColors(accuracy: number, min = 0.75, max = 1) {
	const t = Math.min(1, Math.max(0, (accuracy - min) / (max - min)))
	const low = Math.round(t * 200)
	const high = Math.round((t - 0.5) * 200)

	return t < 0.5
		? {
				light: `color-mix(in oklch, var(--color-yellow-700) ${low}%, var(--color-red-700))`,
				dark: `color-mix(in oklch, var(--color-yellow-300) ${low}%, var(--color-red-300))`,
			}
		: {
				light: `color-mix(in oklch, var(--color-green-700) ${high}%, var(--color-yellow-700))`,
				dark: `color-mix(in oklch, var(--color-green-300) ${high}%, var(--color-yellow-300))`,
			}
}
