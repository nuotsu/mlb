import {
	createSortedRowModel,
	rowPinningFeature,
	rowSortingFeature,
	tableFeatures,
	type SortingState,
} from '@tanstack/svelte-table'
import type { ClassValue } from 'clsx'
import type { Snippet } from 'svelte'

export type { SortingState }

/** What a column sorts by. `null`/`undefined` (and non-numbers in a numeric column) sort last either way. */
export type SortValue = string | number | null | undefined

export type CellArgs<T> = {
	row: T
	/** The column's `value`, if it has one */
	value: SortValue
	/** Position in the sorted table, before `filter` hides any rows: a rank that searching doesn't renumber */
	index: number
}

export type HeaderArgs = {
	/** The column's current sort direction, if it's the one sorting the table */
	sorted: false | 'asc' | 'desc'
	/** The column's `title` */
	title?: string
	/** Sorts by this column, or flips its direction, for a header snippet with its own sort button */
	toggle?: (event?: unknown) => void
}

/**
 * One column of a `DataTable`. Kept small on purpose: the table maps it onto a TanStack column
 * definition, and renders the markup itself.
 */
export type DataTableColumn<T> = {
	id: string
	/** The (abbreviated) header. A snippet replaces the header's contents, sort button and all. */
	header?: string | Snippet<[HeaderArgs]>
	/** Full name, for the header's tooltip and accessible name, e.g. `Batting average` for `AVG` */
	title?: string
	/** Sort value, and what the cell shows when there's no `cell` snippet */
	value?: (row: T) => SortValue
	/** Custom cell contents */
	cell?: Snippet<[CellArgs<T>]>
	/** Text shown for `value` when there's no `cell` snippet */
	format?: (value: SortValue, row: T) => string
	/** Right-aligned, tabular numbers, and sorted highest first */
	numeric?: boolean
	/** Defaults to right for numeric columns, left otherwise */
	align?: 'left' | 'center' | 'right'
	/** Defaults to true for columns with a `value` */
	sortable?: boolean
	/** Direction of the first click; numeric columns default to highest first */
	sortDescFirst?: boolean
	/** Ascending comparison; the table reverses it for descending sorts */
	sortFn?: (a: T, b: T) => number
	/** Pinned to the left edge while the table scrolls sideways */
	sticky?: boolean
	/** Rendered as the row's `<th scope="row">` */
	rowHeader?: boolean
	/** On both the header and body cells (widths, borders) */
	class?: ClassValue
	headerClass?: ClassValue
	cellClass?: ClassValue | ((row: T, value: SortValue) => ClassValue)
	/** The team whose colors fill this cell, via the site-wide `--team-bg` treatment */
	team?: (row: T) => { team?: MLB.Team; sport?: MLB.Sport } | undefined
}

/** Stable across every table, as TanStack asks. */
export const features = tableFeatures({
	rowSortingFeature,
	rowPinningFeature,
	sortedRowModel: createSortedRowModel(),
})

/** Numbers by size, anything else alphabetically. */
export function compareValues(a: SortValue, b: SortValue) {
	if (typeof a === 'number' && typeof b === 'number') return a - b
	return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true })
}

/**
 * Stats arrive as strings (`'.300'`, `'3.45'`); a numeric column sorts them as numbers, and
 * placeholders like `'-'` or `'-.--'` sink to the bottom with the missing values.
 */
export function toSortValue(value: SortValue, numeric?: boolean): SortValue {
	if (value === null || value === undefined || value === '') return undefined
	if (!numeric || typeof value === 'number') return Number.isNaN(value) ? undefined : value

	const n = Number(String(value).replace(/^\+/, '').replace('−', '-'))
	return Number.isFinite(n) ? n : undefined
}

/** `?sort=hits` is lowest first, `?sort=-hits` highest first. */
export function encodeSorting(sorting: SortingState) {
	const [first] = sorting
	return first ? `${first.desc ? '-' : ''}${first.id}` : ''
}

export function decodeSorting(param: string | null | undefined): SortingState | undefined {
	if (!param) return undefined
	const desc = param.startsWith('-')
	return [{ id: desc ? param.slice(1) : param, desc }]
}

/** Midfield's team "spot", blown up so only its main color shows (see `app.css`). */
export function teamBg(team?: Pick<MLB.Team, 'id'>) {
	return team?.id ? `url(https://midfield.mlbstatic.com/v1/team/${team.id}/spots/32)` : undefined
}
