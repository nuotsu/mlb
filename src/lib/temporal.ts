import { debounce } from '$lib/utils'

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

export function createDateChangeHandler(
	getCurrentDate: () => string | undefined,
	navigate: (date: string) => void,
	delay: number = 2500,
) {
	const debouncedNavigate = debounce(navigate, delay)

	return (newDate: string) => {
		const newDay = newDate.split('-')[2]
		const currentDay = getCurrentDate()?.split('-')[2]

		if (newDay !== currentDay) {
			navigate(newDate)
		} else {
			debouncedNavigate(newDate)
		}
	}
}
