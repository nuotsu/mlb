export function getToday(timeZone: string = 'America/Los_Angeles') {
	const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())
	return new Date(dateStr.replace(/-/g, '/'))
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
		typeof date === 'string' ? new Date(date.includes('T') ? date : slash(date)) : date,
	)
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: Date | string, to: Date | string) {
	const a = (typeof from === 'string' ? new Date(slash(from)) : from).getTime()
	const b = (typeof to === 'string' ? new Date(slash(to)) : to).getTime()
	return Math.round((b - a) / 86_400_000)
}

/** Adds `days` to a YYYY-MM-DD date, returning the same format. */
export function addDays(date: string, days: number) {
	const d = new Date(slash(date))
	d.setDate(d.getDate() + days)
	return formatDate(d, { locale: 'en-CA' })
}

/** "today" / "tomorrow" / "in 12d" / "12d ago", relative to `from`. */
export function formatRelativeDays(
	date: Date | string,
	{
		from = getToday(),
		locale = 'en-US',
		style = 'narrow',
	}: { from?: Date | string; locale?: string; style?: Intl.RelativeTimeFormatStyle } = {},
) {
	return new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style }).format(
		daysBetween(from, date),
		'day',
	)
}

export function formatWeekRange(date: string) {
	const t = new Date(date)
	const startDate = new Date(t.setDate(t.getDate() - ((t.getDay() + 6) % 7)))
	const endDate = new Date(t.setDate(t.getDate() + (6 - ((t.getDay() + 6) % 7))))
	const isSameMonth = startDate.getMonth() === endDate.getMonth()

	return [
		formatDate(startDate, { month: 'short', day: 'numeric' }),
		formatDate(endDate, isSameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' }),
	].join(' - ')
}
