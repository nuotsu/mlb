/**
 * Primary brand color for each current MLB club, keyed by team ID. The Stats API doesn't
 * return colors, so this is hand-maintained. Relocated franchises keep their ID (Brooklyn
 * Dodgers are 119, the Expos are 120), so historical seasons mostly resolve too; anything
 * missing falls back to a neutral swatch.
 */
export const TEAM_COLORS: Record<number, string> = {
	108: '#ba0021', // Los Angeles Angels
	109: '#a71930', // Arizona Diamondbacks
	110: '#df4601', // Baltimore Orioles
	111: '#bd3039', // Boston Red Sox
	112: '#0e3386', // Chicago Cubs
	113: '#c6011f', // Cincinnati Reds
	114: '#00385d', // Cleveland Guardians
	115: '#333366', // Colorado Rockies
	116: '#0c2340', // Detroit Tigers
	117: '#002d62', // Houston Astros
	118: '#004687', // Kansas City Royals
	119: '#005a9c', // Los Angeles Dodgers
	120: '#ab0003', // Washington Nationals
	121: '#002d72', // New York Mets
	133: '#003831', // Athletics
	134: '#27251f', // Pittsburgh Pirates
	135: '#2f241d', // San Diego Padres
	136: '#0c2c56', // Seattle Mariners
	137: '#27251f', // San Francisco Giants
	138: '#c41e3a', // St. Louis Cardinals
	139: '#092c5c', // Tampa Bay Rays
	140: '#003278', // Texas Rangers
	141: '#134a8e', // Toronto Blue Jays
	142: '#002b5c', // Minnesota Twins
	143: '#e81828', // Philadelphia Phillies
	144: '#13274f', // Atlanta Braves
	145: '#27251f', // Chicago White Sox
	146: '#00a3e0', // Miami Marlins
	147: '#0c2340', // New York Yankees
	158: '#12284b', // Milwaukee Brewers
}

export const FALLBACK_TEAM_COLOR = '#525252' // neutral-600

export function teamColor(teamId?: number) {
	return (teamId && TEAM_COLORS[teamId]) || FALLBACK_TEAM_COLOR
}
