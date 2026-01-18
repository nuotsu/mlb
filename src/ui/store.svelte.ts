import { browser } from '$app/environment'

export const colorSchemeStore = $state({
	colorScheme: browser ? localStorage.getItem('color-scheme') || 'auto' : 'auto',

	get mode() {
		if (browser) {
			return this.colorScheme === 'auto'
				? window.matchMedia('(prefers-color-scheme: dark)').matches
					? 'dark'
					: 'light'
				: this.colorScheme
		}
		return this.colorScheme
	},
})
