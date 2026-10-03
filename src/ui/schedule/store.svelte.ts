import { formatDate, slash } from '#lib/temporal.js'

export function getWeekDates(date: string) {
	const t = new Date(slash(date))

	const startDate = new Date(t.setDate(t.getDate() - ((t.getDay() + 6) % 7)))
	const endDate = new Date(t.setDate(t.getDate() + (6 - ((t.getDay() + 6) % 7))))

	return {
		startDate: formatDate(startDate, { locale: 'en-CA' }),
		endDate: formatDate(endDate, { locale: 'en-CA' }),
	}
}
