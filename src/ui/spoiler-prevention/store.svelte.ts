import { settingsChanged } from '#ui/account/changes.js'
import { browser } from '$app/env'

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
			settingsChanged()
		}
	},

	remove(teamId: number) {
		this.teams = this.teams.filter((t) => t.id !== teamId)
		this._save()
		settingsChanged()
	},

	toggle(team: App.SpoilerPrevention) {
		if (this.has(team.id)) {
			this.remove(team.id)
		} else {
			this.add(team)
		}
	},

	/** Replace everything (from the account) without reporting it as a change */
	_replace(teams: App.SpoilerPrevention[]) {
		this.teams = teams
		this._save()
	},

	_save() {
		if (browser) {
			localStorage.setItem('spoiler-prevention', JSON.stringify(this.teams))
		}
	},
})
