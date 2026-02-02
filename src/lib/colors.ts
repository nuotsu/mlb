export function isDarkOnLightTeam(team?: MLB.Team) {
	if (!team) return false

	return (
		[
			'Asheville Tourists',
			'Miami Marlins',
			'Minnesota Golden Gophers',
			'San Diego Padres',
			'San Francisco Giants',
			'Sugar Land Space Cowboys',
			'Sultanes de Monterrey',
			'Tampa Bay Rays',
			'Northeastern Huskies',
		].includes(team.name) || [51].includes((team as MLB.TeamDetailed).sport?.id ?? 1)
	)
}

export function isLightOnDarkTeam(team?: MLB.Team) {
	if (!team) return false

	return ['Hanshin Tigers', 'Tokyo Yomiuri Giants'].includes(team.name)
}
