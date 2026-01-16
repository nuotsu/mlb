export const getToday = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60 * 1000)

export function formatDate(date: Date, options: Intl.DateTimeFormatOptions = {}) {
	return new Intl.DateTimeFormat('en-US', options).format(date)
}
