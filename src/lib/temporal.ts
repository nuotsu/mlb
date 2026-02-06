export function getToday() {
	return new Date(Date.now() - new Date().getTimezoneOffset() * 60 * 1000)
}

/** Converts YYYY-MM-DD to YYYY/MM/DD to avoid UTC parsing issues */
export function slash(date?: string) {
	return date?.replace(/-/g, '/') ?? ''
}

export function formatDate(
	date: Date | string,
	options: Intl.DateTimeFormatOptions & { locale?: string } = { locale: 'en-US' },
) {
	return new Intl.DateTimeFormat(options.locale, options).format(
		typeof date === 'string' ? new Date(date) : date,
	)
}

export function formatWeekRange(date: string) {
	const t = new Date(slash(date))
	const startDate = new Date(t.setDate(t.getDate() - ((t.getDay() - 1) % 7)))
	const endDate = new Date(t.setDate(t.getDate() + (6 - ((t.getDay() - 1) % 7))))
	const isSameMonth = startDate.getMonth() === endDate.getMonth()

	return [
		formatDate(startDate, { month: 'short', day: 'numeric' }),
		formatDate(endDate, isSameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' }),
	].join(' - ')
}
