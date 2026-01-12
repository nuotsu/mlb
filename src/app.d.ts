// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	namespace Docs {
		interface EndpointSchema {
			[endpoint: string]: {
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
		}
	}
}

export {}
