export const HOST = 'https://statsapi.mlb.com/api/v1'

export const DIRECTORY: Record<string, Docs.EndpointFragment> = {
	Players: {
		'/people/{personId}': {},
		'/people/{personId}/stats': {},
	},
	Teams: {
		'/teams': {},
	},
	Schedule: {
		'/schedule': {},
	},
	Standings: {
		'/standings': {},
	},
} as const

export const PARAMS: Record<string, { value: string; label: string }[]> = {
	personId: [
		{ value: '660271', label: 'Shohei Ohtani' },
		{ value: '669373', label: 'Tarik Skubal' },
		{ value: '592450', label: 'Aaron Judge' },
	],
} as const
