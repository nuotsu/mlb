import { slash } from '$lib/temporal'

export function getWeekDates(date: string) {
	const t = new Date(slash(date))

	const startDate = new Date(t.setDate(t.getDate() - ((t.getDay() - 1) % 7)))
	const endDate = new Date(t.setDate(t.getDate() + (6 - ((t.getDay() - 1) % 7))))

	return {
		startDate,
		endDate,
	}
}
