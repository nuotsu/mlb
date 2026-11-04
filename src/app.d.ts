// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Signed-in user, or `null` when signed out (or accounts aren't configured) */
			user: import('#lib/server/auth.js').SessionUser | null
			session: import('#lib/server/auth.js').Session | null
		}
		interface PageData {
			/** Whether sign-in is configured on the server */
			accounts?: boolean
			/** Origin sign-in must start from, when fixed by `BETTER_AUTH_URL` */
			authOrigin?: string | null
			/** Public profile of the signed-in user, from the root `+layout.server.ts` */
			user?: import('#lib/account.js').AccountUser | null
		}
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
