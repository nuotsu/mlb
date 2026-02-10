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

	has(href: App.Favorite['href']) {
		return this.favorites.some((f) => f.href === href)
	},

	add(favorite: App.Favorite) {
		if (!this.has(favorite.href)) {
			this.favorites.push(favorite)
			this._save()
		}
	},

	remove({ href }: App.Favorite) {
		this.favorites = this.favorites.filter((f) => f.href !== href)
		this._save()
	},

	toggle(favorite: App.Favorite) {
		if (this.has(favorite.href)) {
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

export function sortGames(a: MLB.Game, b: MLB.Game) {
	const aFavorite =
		favoritesStore.has(`/teams/${a.teams.home.team.id}`) ||
		favoritesStore.has(`/teams/${a.teams.away.team.id}`)
	const bFavorite =
		favoritesStore.has(`/teams/${b.teams.home.team.id}`) ||
		favoritesStore.has(`/teams/${b.teams.away.team.id}`)
	if (aFavorite && !bFavorite) return -1
	if (!aFavorite && bFavorite) return 1
	return 0
}
