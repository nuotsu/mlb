import { browser } from '$app/environment'

function load(): App.SpoilerPrevention[] {
	if (!browser) return []
	try {
		return JSON.parse(localStorage.getItem('spoiler-prevention') || '[]')
	} catch {
		return []
	}
}

export const spoilerPreventionStore = $state({
	teams: load(),

	has(teamId: number) {
		return this.teams.some((t) => t.id === teamId)
	},

	add(team: App.SpoilerPrevention) {
		if (!this.has(team.id)) {
			this.teams.push(team)
			this._save()
		}
	},

	remove(teamId: number) {
		this.teams = this.teams.filter((t) => t.id !== teamId)
		this._save()
	},

	toggle(team: App.SpoilerPrevention) {
		if (this.has(team.id)) {
			this.remove(team.id)
		} else {
			this.add(team)
		}
	},

	_save() {
		if (browser) {
			localStorage.setItem('spoiler-prevention', JSON.stringify(this.teams))
		}
	},
})
