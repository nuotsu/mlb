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
