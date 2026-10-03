import { browser } from '$app/env'

const KEY = 'compare'

function load(): number[] {
	if (!browser) return []
	try {
		const raw = localStorage.getItem(KEY)
		if (!raw) return []
		return raw
			.split(',')
			.map(Number)
			.filter((id) => !isNaN(id) && id > 0)
	} catch {
		return []
	}
}

export const compareStore = $state({
	ids: load(),

	has(id: number) {
		return this.ids.includes(id)
	},

	/** @returns 0 (first), 1 (second), or -1 (not in list) */
	position(id: number): number {
		return this.ids.indexOf(id)
	},

	add(id: number) {
		if (!this.has(id)) {
			this.ids.push(id)
			this._save()
		}
	},

	remove(id: number) {
		this.ids = this.ids.filter((i) => i !== id)
		this._save()
	},

	toggle(id: number) {
		if (this.has(id)) {
			this.remove(id)
		} else {
			this.add(id)
		}
	},

	_save() {
		if (browser) {
			localStorage.setItem(KEY, this.ids.join(','))
		}
	},
})
