import { dev } from '$app/environment'
import { formatDate, getToday } from '$lib/temporal'

export const scheduleStore = $state({
	today: formatDate(dev ? '2026-02-20' : getToday(), {
		locale: 'en-CA',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}),

	get t() {
		return new Date(this.today)
	},

	addWeek(weeks: number = 1) {
		this.today = formatDate(new Date(this.t.setDate(this.t.getDate() + weeks * 7)), {
			locale: 'en-CA',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		})
	},

	get startDate() {
		return new Date(this.t.setDate(this.t.getDate() - ((this.t.getDay() - 1) % 7)))
	},

	get endDate() {
		return new Date(this.t.setDate(this.t.getDate() + 6))
	},
})
