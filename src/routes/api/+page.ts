import { CUSTOM_ENDPOINT_KEY } from '$ui/playground/constants'

export const load = async () => {
	return {
		endpointKey: CUSTOM_ENDPOINT_KEY,
		initialParams: {} as Record<string, string>,
	}
}
