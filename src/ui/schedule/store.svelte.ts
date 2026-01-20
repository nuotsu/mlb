import { formatDate, getToday } from '$lib/temporal'

export const weekStore = $state({
	today: formatDate(getToday(), { locale: 'en-CA' }),

	get t() {
		return new Date(this.today)
	},

	get startDate() {
		return new Date(this.t.setDate(this.t.getDate() - ((this.t.getDay() - 1) % 7)))
	},

	get endDate() {
		return new Date(this.t.setDate(this.t.getDate() + (6 - ((this.t.getDay() - 1) % 7))))
	},
})
