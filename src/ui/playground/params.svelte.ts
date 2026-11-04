import { initialValues, type ParamValues } from './request'

/** Editable values for one endpoint's params, seeded from the URL then the presets */
export class ParamState {
	values = $state<ParamValues>({})

	constructor(endpointKey: string, initialParams?: Record<string, string>) {
		this.values = initialValues(endpointKey, initialParams)
	}
}
