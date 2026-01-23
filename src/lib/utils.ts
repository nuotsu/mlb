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
