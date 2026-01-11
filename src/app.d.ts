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
		interface EndpointFragment {
			[endpoint: string]: {
				parameters?: EndpointParameter
			}
		}

		interface EndpointParameter {
			[parameter: string]: EndpointParameterValues[]
		}

		interface EndpointParameterValues {
			value: string
			label: string
		}
	}
}

export {}
