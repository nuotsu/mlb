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
				parameters?: EndpointParams
			}
		}

		interface EndpointParams {
			[parameter: string]: EndpointParameterProps[]
		}

		interface EndpointParameterProps {
			value: string
			label?: string
		}
	}
}

export {}
