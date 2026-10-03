import { CUSTOM_ENDPOINT_KEY } from '#ui/playground/constants.js'

export const load = async ({ params }) => {
	return {
		endpointKey: CUSTOM_ENDPOINT_KEY,
		initialParams: { custom: `/api/${params.version}/` },
	}
}
