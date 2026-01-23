export function getToday() {
	return new Date(Date.now() - new Date().getTimezoneOffset() * 60 * 1000)
}

/**
 * Converts a hyphenated date string (YYYY-MM-DD) to slash format (YYYY/MM/DD).
 * This ensures dates are parsed as local time instead of UTC when used in Date constructors.
 */
export function slash(date: string) {
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
