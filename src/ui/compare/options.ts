import type { CompareGroup } from '#lib/compare.js'

export const GROUPS: { id: CompareGroup; label: string }[] = [
	{ id: 'hitting', label: 'Hitting' },
	{ id: 'pitching', label: 'Pitching' },
	{ id: 'fielding', label: 'Fielding' },
]

export type ScopeId = 'season' | 'career' | 'projected' | 'dates' | 'vsTeam'

export const SCOPES: {
	id: ScopeId
	label: string
	/** Stat types hydrated together, standard first */
	types: string[]
}[] = [
	{ id: 'season', label: 'Season', types: ['season', 'seasonAdvanced'] },
	{ id: 'career', label: 'Career', types: ['careerRegularSeason', 'careerAdvanced'] },
	{ id: 'projected', label: 'Projected', types: ['projected'] },
	{ id: 'dates', label: 'Date range', types: ['byDateRange', 'byDateRangeAdvanced'] },
	{ id: 'vsTeam', label: 'vs Team', types: ['vsTeamTotal'] },
]

export type LayoutId = 'table' | 'bars' | 'tiles'

export const LAYOUTS: { id: LayoutId; label: string }[] = [
	{ id: 'table', label: 'Table' },
	{ id: 'bars', label: 'Head to head' },
	{ id: 'tiles', label: 'Tiles' },
]

export type CompareQuery = {
	ids: number[]
	group: CompareGroup
	scope: ScopeId
	season: number
	startDate: string
	endDate: string
	opposingTeamId?: number
}
