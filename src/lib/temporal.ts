export function getToday() {
	return new Date(Date.now() - new Date().getTimezoneOffset() * 60 * 1000)
}

export function toSlashDate(date: string) {
	return date.replace(/-/g, '/')
}

export function formatDate(
	date: Date | string,
	options: Intl.DateTimeFormatOptions & { locale?: string } = { locale: 'en-US' },
) {
	return new Intl.DateTimeFormat(options.locale, options).format(
		typeof date === 'string' ? new Date(date) : date,
	)
}
