import { dev } from '$app/environment'
import { formatDate, getToday } from '$lib/temporal'

const sampleDates = ['2026-03-26', '2024-09-17']

export const scheduleStore = $state({
	today: formatDate(dev ? sampleDates[1] : getToday(), {
		locale: 'en-CA',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}),

	get t() {
		return new Date(this.today)
	},

	get startDate() {
		return new Date(this.t.setDate(this.t.getDate() - ((this.t.getDay() - 1) % 7)))
	},

	get endDate() {
		return new Date(this.t.setDate(this.t.getDate() + (6 - ((this.t.getDay() - 1) % 7))))
	},

	addWeek(weeks: number = 1) {
		this.today = formatDate(
			new Date(this.startDate.setDate(this.startDate.getDate() + weeks * 7)),
			{
				locale: 'en-CA',
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
			},
		)
	},
})
