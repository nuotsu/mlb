import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

export function count<T = any>(arr: T[] | number, singular: string = 'item', plural?: string) {
	const n = typeof arr === 'number' ? arr : (arr?.length ?? 0)
	return `${n.toLocaleString()} ${n === 1 ? singular : plural || singular + 's'}`
}
