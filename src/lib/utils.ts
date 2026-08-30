import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

export function count<T = any>(arr: T[] | number, singular: string = 'item', plural?: string) {
	const n = typeof arr === 'number' ? arr : (arr?.length ?? 0)
	return `${n.toLocaleString()} ${n === 1 ? singular : plural || singular + 's'}`
}

export function debounce<T extends (...args: any[]) => any>(
	fn: T,
	delay: number = 1000,
): (...args: Parameters<T>) => void {
	let timeoutId: ReturnType<typeof setTimeout>
	return (...args: Parameters<T>) => {
		clearTimeout(timeoutId)
		timeoutId = setTimeout(() => fn(...args), delay)
	}
}

export function shuffle<T>(arr: T[]): T[] {
	const a = [...arr]
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[a[i], a[j]] = [a[j], a[i]]
	}
	return a
}

const ORDINAL_SUFFIXES: Record<Intl.LDMLPluralRule, string> = {
	zero: 'th',
	one: 'st',
	two: 'nd',
	few: 'rd',
	many: 'th',
	other: 'th',
}

/** 1 → "1st", 15 → "15th" */
export function ordinal(n: number) {
	return `${n}${ORDINAL_SUFFIXES[new Intl.PluralRules('en-US', { type: 'ordinal' }).select(n)]}`
}
