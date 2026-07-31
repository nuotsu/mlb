// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}

		interface Breadcrumb {
			href?: string
			name?: string
		}

		type Favorite = {
			href: string
			label: string
		}

		type SpoilerPrevention = {
			id: number
			abbreviation: string
		}

		type RandomEntity =
			| ({ type: 'team' } & MLB.Team)
			| ({ type: 'player' } & MLB.Person)
			| ({ type: 'game' } & MLB.Game)
	}

	namespace Fetch {
		type QueryParamKeys =
			| keyof typeof PRESETS
			| 'startDate'
			| 'endDate'
			| 'fields'
			| 'hydrate'
			| 'names'
			| (string & {})

		type Params = Partial<Record<QueryParamKeys, string | string[]>>
	}

	namespace Docs {
		interface EndpointSchema {
			[endpoint: string]: {
				description?: string
				pathParams?: EndpointParams
				queryParams?: EndpointParams
			}
		}

		interface EndpointParams {
			[key: string]: EndpointParamProps[]
		}

		interface EndpointParamProps {
			value: string
			label?: string
			empty?: boolean
			placeholder?: string
		}
	}

	namespace Blog {
		interface Post {
			slug: string
			date: string
			title: string
			description?: string
			image?: string
			tags?: string[]
			draft?: boolean
		}
	}
}

export {}
