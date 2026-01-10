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
}

export const PARAMS = {
	personId: '660271', // Shohei Ohtani
} as const
