import { browser } from '$app/environment'

function loadFavorites(): App.Favorite[] {
	if (!browser) return []
	try {
		return JSON.parse(localStorage.getItem('favorites') || '[]')
	} catch {
		return []
	}
}

export const favoritesStore = $state({
	favorites: loadFavorites(),

	has({ href }: App.Favorite) {
		return this.favorites.some((f) => f.href === href)
	},

	add(favorite: App.Favorite) {
		if (!this.has(favorite)) {
			this.favorites.push(favorite)
			this._save()
		}
	},

	remove({ href }: App.Favorite) {
		this.favorites = this.favorites.filter((f) => f.href !== href)
		this._save()
	},

	toggle(favorite: App.Favorite) {
		if (this.has(favorite)) {
			this.remove(favorite)
		} else {
			this.add(favorite)
		}
	},

	_save() {
		if (browser) {
			localStorage.setItem('favorites', JSON.stringify(this.favorites))
		}
	},
})

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
