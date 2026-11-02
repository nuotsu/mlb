<!--
	@component
	The site's one table: TanStack Table for sorting and pinned rows, TanStack Virtual for long
	tables, and markup of our own.

	- Click or tap a header to sort; `sortParam` keeps the sort in the address, `sortHref` turns the
	  headers into links for sorts the server does, and `sorting`/`onSortingChange` hand it to the page.
	- The header sticks while the page (or the table's own scroller, once it's wider than the screen)
	  scrolls, and `sticky` columns stay put while the table scrolls sideways, with a fade on the
	  edge that has more columns past it.
	- Past `virtualThreshold` rows only the rows in view are rendered.
-->
<script lang="ts" generics="T extends RowData">
	import {
		createTable,
		type Column,
		type ColumnDef,
		type Row,
		type RowData,
		type SortingState,
		type Updater,
	} from '@tanstack/svelte-table'
	import { createVirtualizer } from '@tanstack/svelte-virtual'
	import { isDarkOnLightTeam, isLightOnDarkTeam } from '#lib/colors.js'
	import { currentUrl, setViewParam } from '#lib/url.svelte.js'
	import { cn } from '#lib/utils.js'
	import type { ClassValue } from 'clsx'
	import { onMount, untrack, type Snippet } from 'svelte'
	import type { HTMLAttributes } from 'svelte/elements'
	import { get } from 'svelte/store'
	import {
		compareValues,
		decodeSorting,
		encodeSorting,
		features,
		teamBg,
		toSortValue,
		type DataTableColumn,
		type SortValue,
	} from './types'

	type Features = typeof features

	let {
		data,
		columns,
		getRowId,
		label,
		sortable = true,
		sorting: controlledSorting,
		onSortingChange,
		defaultSorting = [],
		sortParam,
		manualSorting = false,
		sortHref,
		enableSortingRemoval,
		pinnedTop,
		filter,
		rowClass,
		rowAttrs,
		stickyHeader = true,
		virtualize = 'auto',
		virtualThreshold = 50,
		density = 'comfortable',
		hideHeader = false,
		class: className,
		tableClass,
		empty,
		...props
	}: {
		data: readonly T[]
		columns: readonly DataTableColumn<T>[]
		getRowId: (row: T, index: number) => string
		/** The table's accessible name */
		label?: string
		/** Off to make every column unsortable */
		sortable?: boolean
		/** Controlled sorting: the page owns the state */
		sorting?: SortingState
		onSortingChange?: (sorting: SortingState) => void
		/** The sort with nothing chosen: the starting sort, and what `sortParam` falls back to */
		defaultSorting?: SortingState
		/** Keeps the sort in this query parameter (a shallow update, so `load` doesn't rerun) */
		sortParam?: string
		/** The rows arrive sorted, e.g. by the server; `sorting` only drives the headers */
		manualSorting?: boolean
		/** Headers become links to this URL, for sorts that need a new page load */
		sortHref?: (columnId: string) => string
		/** A third click restores the original order; defaults to on when there's no `defaultSorting` */
		enableSortingRemoval?: boolean
		/** Rows kept on top whatever the sort, like a career line */
		pinnedTop?: (row: T) => boolean
		/** Hides rows after sorting, so `index` (a rank) still counts them */
		filter?: (row: T) => boolean
		rowClass?: (row: T, index: number, rows: readonly T[]) => ClassValue
		rowAttrs?: (row: T, index: number) => Record<string, string | undefined>
		stickyHeader?: boolean
		/** `'auto'` virtualizes past `virtualThreshold` rows */
		virtualize?: boolean | 'auto'
		virtualThreshold?: number
		/**
		 * Comfortable rows are 40px tall, a tap target. Compact ones shrink for a mouse but stay 40px
		 * for touch. Tight rows are a line tall, for tables with nothing to tap, like a linescore.
		 */
		density?: 'comfortable' | 'compact' | 'tight'
		/** For tables whose rows speak for themselves; screen readers still get the headers */
		hideHeader?: boolean
		class?: ClassValue
		tableClass?: ClassValue
		empty?: Snippet
	} & Omit<HTMLAttributes<HTMLDivElement>, 'class'> = $props()

	/* sorting */

	let ownSorting = $state(untrack(() => defaultSorting))

	const sorting = $derived.by((): SortingState => {
		if (controlledSorting) return controlledSorting
		if (sortParam) return decodeSorting(currentUrl().searchParams.get(sortParam)) ?? defaultSorting
		return ownSorting
	})

	function setSorting(updater: Updater<SortingState>) {
		const next = typeof updater === 'function' ? updater(sorting) : updater
		onSortingChange?.(next)
		if (sortParam) setViewParam(sortParam, encodeSorting(next), encodeSorting(defaultSorting))
		else if (!controlledSorting) ownSorting = next
	}

	/* columns */

	const columnDefs = $derived(
		columns.map((column): ColumnDef<Features, T> => {
			const { id, value, numeric } = column
			const canSort = sortable && column.sortable !== false && (!!value || !!column.sortFn)

			return {
				id,
				header: column.title ?? (typeof column.header === 'string' ? column.header : id),
				accessorFn: (row: T) => toSortValue(value?.(row), numeric),
				enableSorting: canSort,
				sortDescFirst: column.sortDescFirst ?? !!numeric,
				sortUndefined: 'last',
				sortFn: column.sortFn
					? (a: Row<Features, T>, b: Row<Features, T>) => column.sortFn!(a.original, b.original)
					: (a: Row<Features, T>, b: Row<Features, T>, columnId: string) =>
							compareValues(a.getValue<SortValue>(columnId), b.getValue<SortValue>(columnId)),
			}
		}),
	)

	const byId = $derived(new Map(columns.map((column) => [column.id, column])))

	const pinnedIds = $derived(
		pinnedTop ? data.flatMap((row, i) => (pinnedTop(row) ? [getRowId(row, i)] : [])) : [],
	)

	const rowPinning = $derived({ top: pinnedIds, bottom: [] as string[] })

	const table = createTable({
		features,
		get data() {
			return data as T[]
		},
		get columns() {
			return columnDefs
		},
		getRowId: (row, index) => getRowId(row, index),
		state: {
			get sorting() {
				return sorting
			},
			get rowPinning() {
				return rowPinning
			},
		},
		onSortingChange: setSorting,
		get manualSorting() {
			return manualSorting || !!sortHref
		},
		enableMultiSort: false,
		get enableSortingRemoval() {
			return enableSortingRemoval ?? !defaultSorting.length
		},
		keepPinnedRows: true,
	})

	/* rows */

	const topRows = $derived(pinnedTop ? table.getTopRows() : [])

	/** Every unpinned row in sorted order, with its place in that order */
	const sortedRows = $derived(
		(pinnedTop ? table.getCenterRows() : table.getRowModel().rows).map((row, index) => ({
			row,
			index,
		})),
	)

	/** The rows shown, each with its place among them (`position`) */
	const rows = $derived(
		(filter ? sortedRows.filter(({ row }) => filter(row.original)) : sortedRows).map(
			(entry, position) => ({ ...entry, position }),
		),
	)

	const originals = $derived(rows.map(({ row }) => row.original))

	/* layout */

	const isVirtual = $derived(
		virtualize === true || (virtualize === 'auto' && rows.length > virtualThreshold),
	)

	let scroller = $state<HTMLDivElement>()
	let tableEl = $state<HTMLTableElement>()
	let theadHeight = $state(0)

	/** Wider than its box, so it scrolls sideways. Assumed until measured, so a wide table never spills out. */
	let overflowsX = $state(true)
	/** More columns past the left/right edge */
	let moreLeft = $state(false)
	let moreRight = $state(false)

	/**
	 * Where the header sticks. A table that fits stays out of any scroller of its own, so its
	 * header sticks under the page header as the page scrolls. One that scrolls sideways (or is
	 * virtualized) becomes a scroller both ways, as tall as the screen below the page header, since
	 * a sideways-only scroller would trap a sticky header.
	 */
	const mode = $derived<'page' | 'container' | 'x'>(
		!stickyHeader && !isVirtual ? 'x' : isVirtual || overflowsX ? 'container' : 'page',
	)

	function measure() {
		if (!scroller || !tableEl) return
		const { scrollLeft, clientWidth, scrollWidth } = scroller
		overflowsX = tableEl.offsetWidth > clientWidth + 1
		moreLeft = overflowsX && scrollLeft > 1
		moreRight = overflowsX && scrollLeft + clientWidth < scrollWidth - 1
	}

	$effect(() => {
		if (!scroller || !tableEl) return
		const observer = new ResizeObserver(measure)
		observer.observe(scroller)
		observer.observe(tableEl)
		return () => observer.disconnect()
	})

	const hasSticky = $derived(columns.some((column) => column.sticky))

	/* virtualization */

	/** Before hydration there's nothing to measure, so the server sends this many rows */
	const SSR_ROWS = 30

	let mounted = $state(false)
	onMount(() => (mounted = true))

	const rowHeight = $derived(density === 'comfortable' ? 40 : density === 'compact' ? 32 : 24)

	const virtualizer = createVirtualizer<HTMLDivElement, HTMLTableRowElement>({
		count: untrack(() => rows.length),
		getScrollElement: () => scroller ?? null,
		estimateSize: () => untrack(() => rowHeight),
		overscan: 10,
		enabled: false,
	})

	$effect(() => {
		get(virtualizer).setOptions({
			count: rows.length,
			enabled: isVirtual,
			getScrollElement: () => scroller ?? null,
			estimateSize: () => rowHeight,
			getItemKey: (i) => rows[i]?.row.id ?? i,
			scrollMargin: theadHeight + topRows.length * rowHeight,
		})
	})

	const windowed = $derived.by(() => {
		if (!isVirtual) return { items: rows, before: 0, after: 0 }

		if (!mounted) {
			const items = rows.slice(0, SSR_ROWS)
			return { items, before: 0, after: (rows.length - items.length) * rowHeight }
		}

		const v = $virtualizer
		const virtualItems = v.getVirtualItems()
		const margin = v.options.scrollMargin
		const first = virtualItems[0]
		const last = virtualItems.at(-1)

		return {
			items: virtualItems.flatMap(({ index }) => (rows[index] ? [rows[index]] : [])),
			before: first ? first.start - margin : 0,
			after: last ? v.getTotalSize() - (last.end - margin) : 0,
		}
	})

	function measureRow(el: HTMLTableRowElement) {
		if (isVirtual && mounted) get(virtualizer).measureElement(el)
	}

	/* rendering helpers */

	function alignOf(column: DataTableColumn<T>) {
		return column.align ?? (column.numeric ? 'right' : 'left')
	}

	const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const
	const JUSTIFY = { left: 'justify-start', center: 'justify-center', right: 'justify-end' } as const

	const ariaSort = (column: Column<Features, T>) =>
		column.getIsSorted() === 'asc'
			? 'ascending'
			: column.getIsSorted() === 'desc'
				? 'descending'
				: 'none'

	function stickyCell(column: DataTableColumn<T>) {
		return (
			column.sticky && [
				'sticky left-0 z-1 bg-background',
				// a hairline and a soft edge once columns slide under it
				moreLeft && 'shadow-[1px_0_var(--color-stroke),6px_0_6px_-6px_rgb(0_0_0/0.4)]',
			]
		)
	}

	function teamCell(row: T, column: DataTableColumn<T>) {
		const { team, sport } = column.team?.(row) ?? {}
		if (!team) return { class: undefined, bg: undefined }
		return {
			class: [
				'relative isolate',
				isDarkOnLightTeam(team, sport) && 'dark:text-dark',
				isLightOnDarkTeam(team) && 'dark:text-light',
			],
			bg: teamBg(team),
		}
	}

	function cellText(column: DataTableColumn<T>, row: T, value: SortValue) {
		if (column.format) return column.format(value, row)
		return value ?? '-'
	}
</script>

<div
	bind:this={scroller}
	class={cn(
		'relative',
		mode === 'container' &&
			'max-h-[calc(100dvh+1px-var(--header-height,0px))] overflow-auto overscroll-x-contain sm:sidebar-open:max-h-[calc(100dvh+1px-1ch-var(--header-height,0px))]',
		mode === 'x' && 'overflow-x-auto overflow-y-hidden overscroll-x-contain',
		moreRight &&
			(moreLeft && !hasSticky ? 'mask-x-from-[calc(100%-2ch)]' : 'mask-r-from-[calc(100%-2ch)]'),
		!moreRight && moreLeft && !hasSticky && 'mask-l-from-[calc(100%-2ch)]',
		className,
	)}
	onscroll={measure}
	{...props}
>
	<table
		bind:this={tableEl}
		class={cn('w-max min-w-full border-separate border-spacing-0', tableClass)}
		aria-label={label}
		aria-rowcount={isVirtual ? rows.length + topRows.length + 1 : undefined}
	>
		<thead class={cn(hideHeader && 'sr-only')} bind:offsetHeight={theadHeight}>
			<tr aria-rowindex={isVirtual ? 1 : undefined}>
				{#each table.getHeaderGroups()[0]?.headers ?? [] as header (header.id)}
					{@const column = byId.get(header.column.id)!}
					{@const align = alignOf(column)}
					{@const sorted = header.column.getIsSorted()}
					{@const canSort = header.column.getCanSort()}
					{@const label = typeof column.header === 'string' ? column.header : ''}

					<th
						scope="col"
						class={cn(
							'h-10 px-[.5ch] text-sm font-normal whitespace-nowrap text-current/50',
							density === 'compact' && 'pointer-fine:h-8',
							density === 'tight' && 'h-lh',
							ALIGN[align],
							stickyHeader &&
								!hideHeader && [
									'sticky z-2 bg-background shadow-[inset_0_-1px_var(--color-stroke)]',
									mode === 'page' ? 'top-[var(--header-height,0px)]' : 'top-0',
								],
							stickyCell(column),
							column.sticky && 'z-3',
							column.class,
							column.headerClass,
						)}
						aria-sort={canSort ? ariaSort(header.column) : undefined}
						title={column.title}
					>
						{#if typeof column.header === 'function'}
							{@render column.header({
								sorted,
								title: column.title,
								toggle: canSort ? header.column.getToggleSortingHandler() : undefined,
							})}
						{:else if canSort}
							{@const arrow = sorted === 'asc' ? '▲' : '▼'}
							{@const next = header.column.getNextSortingOrder()}
							{@const description = `${column.title ?? label}${
								sortHref ? '' : next ? `, sort ${next === 'asc' ? 'ascending' : 'descending'}` : ''
							}`}
							{@const contents = {
								class: cn(
									'-mx-[.25ch] inline-flex min-h-8 items-center gap-[.25ch] px-[.5ch] outline-offset-[-2px] hover:text-foreground',
									align === 'right' && 'flex-row-reverse',
									sorted && 'bg-foreground font-bold text-background hover:text-background',
								),
								title: description,
							}}

							{#if sortHref}
								<a href={sortHref(header.column.id)} {...contents}>
									{label}
									{@render indicator(arrow, !!sorted)}
								</a>
							{:else}
								<button
									type="button"
									{...contents}
									onclick={header.column.getToggleSortingHandler()}
								>
									{label}
									{@render indicator(arrow, !!sorted)}
								</button>
							{/if}
						{:else if label}
							<span>{label}</span>
						{/if}
					</th>
				{/each}
			</tr>
		</thead>

		<tbody>
			{#each topRows as row, i (row.id)}
				{@render tr(row, -1, i)}
			{/each}

			{#if windowed.before > 0}
				<tr aria-hidden="true"><td class="p-0" style:height="{windowed.before}px"></td></tr>
			{/if}

			{#each windowed.items as { row, index, position } (row.id)}
				{@render tr(row, index, position)}
			{/each}

			{#if windowed.after > 0}
				<tr aria-hidden="true"><td class="p-0" style:height="{windowed.after}px"></td></tr>
			{/if}

			{#if !rows.length && !topRows.length && empty}
				<tr>
					<td colspan={columns.length}>
						<div class="sticky left-0 w-[min(100%,100vw)]">{@render empty()}</div>
					</td>
				</tr>
			{/if}
		</tbody>
	</table>
</div>

{#snippet indicator(arrow: string, active: boolean)}
	<span class={cn('text-[x-small]', !active && 'invisible')} aria-hidden="true">{arrow}</span>
{/snippet}

<!-- `index` is the row's place in the sort (-1 when pinned); `position` its place among the rows shown -->
{#snippet tr(row: Row<Features, T>, index: number, position: number)}
	{@const original = row.original}
	<tr
		class={cn(
			'group/row hover:*:bg-[color-mix(in_srgb,var(--color-foreground)_8%,var(--color-background))]',
			rowClass?.(original, position, originals),
		)}
		data-index={isVirtual && index >= 0 ? position : undefined}
		aria-rowindex={isVirtual ? topRows.length + (index < 0 ? 0 : position + 1) + 1 : undefined}
		{...rowAttrs?.(original, position)}
		{@attach measureRow}
	>
		{#each columns as column (column.id)}
			{@const value = column.value?.(original)}
			{@const team = teamCell(original, column)}
			{@const sorted = table.getColumn(column.id)?.getIsSorted()}
			{@const cls = cn(
				'h-10 px-[.75ch] align-middle',
				density === 'compact' && 'pointer-fine:h-8',
				density === 'tight' && 'h-lh',
				ALIGN[alignOf(column)],
				column.numeric && 'tabular-nums',
				sorted && column.numeric && 'font-bold',
				stickyCell(column),
				team.class,
				column.class,
				typeof column.cellClass === 'function'
					? column.cellClass(original, value)
					: column.cellClass,
			)}

			{#if column.rowHeader}
				<th scope="row" class={cn('font-normal', cls)} style:--team-bg={team.bg}>
					{@render content(column, original, value, index)}
				</th>
			{:else}
				<td class={cls} style:--team-bg={team.bg}>
					{@render content(column, original, value, index)}
				</td>
			{/if}
		{/each}
	</tr>
{/snippet}

{#snippet content(column: DataTableColumn<T>, row: T, value: SortValue, index: number)}
	{#if column.cell}
		{@render column.cell({ row, value, index, columnId: column.id })}
	{:else}
		{cellText(column, row, value)}
	{/if}
{/snippet}
