<script module lang="ts">
	import { warmJsonWorker } from './worker-client'

	/** Called on Send hover/focus so the worker is booted before the response lands */
	export const warm = warmJsonWorker
</script>

<script lang="ts">
	import { createVirtualizer } from '@tanstack/svelte-virtual'
	import ArrowUpIcon from '#ui/icons/arrow-up.svelte'
	import CloseIcon from '#ui/icons/close.svelte'
	import CodeIcon from '#ui/icons/code.svelte'
	import CollapseVerticalIcon from '#ui/icons/collapse-vertical.svelte'
	import CopyIcon from '#ui/icons/copy.svelte'
	import DownloadIcon from '#ui/icons/download.svelte'
	import ExpandVerticalIcon from '#ui/icons/expand-vertical.svelte'
	import FilterIcon from '#ui/icons/filter.svelte'
	import ListUnorderedIcon from '#ui/icons/list-unordered.svelte'
	import PathIcon from '#ui/icons/path.svelte'
	import { onMount, tick } from 'svelte'
	import { get } from 'svelte/store'
	import JsonSkeleton from './json-skeleton.svelte'
	import {
		buildRows,
		isCollapsed,
		keyOf,
		markMatches,
		pathOf,
		revealNode,
		setCollapsed,
		T_ARRAY,
		T_OBJECT,
		T_STRING,
		valueOf,
		type Folding,
		type JsonTable,
	} from './table'
	import { parseJson, searchJson, stringifyJson } from './worker-client'

	let {
		text,
		fileName = 'response.json',
	}: {
		/** Raw response body */
		text: string
		/** Name for the .json download */
		fileName?: string
	} = $props()

	/** Responses with more lines than this open folded below depth 2 */
	const AUTO_FOLD_LINES = 2000
	const AUTO_FOLD_DEPTH = 2
	/** Above this the Raw view offers a download instead of a <pre> */
	const RAW_INLINE_BYTES = 300_000
	const SEARCH_DEBOUNCE_MS = 200
	/** Unfold ancestors of every match only when there are this few; otherwise just the current one */
	const REVEAL_ALL_LIMIT = 200
	const LONG_PRESS_MS = 450
	const HINT_KEYS = ['gamePk', 'id', 'fullName', 'name', 'abbreviation', 'code', 'date']

	let table = $state.raw<JsonTable | null>(null)
	let failed = $state<string | null>(null)
	let timing = $state.raw<{ parseMs: number; flattenMs: number } | null>(null)

	/** Folding lives outside $state (no deep proxy); `foldVersion` tells Svelte it changed */
	const folding: Folding = { depthLimit: Infinity, toggled: new Set() }
	let foldVersion = $state(0)
	let depthLimit = $state(Infinity)

	let view = $state<'tree' | 'raw'>('tree')
	let rawPretty = $state<string | null>(null)

	let query = $state('')
	let searched = $state('')
	let matches = $state.raw<Int32Array>(new Int32Array(0))
	let current = $state(0)
	let filterMatches = $state(false)
	let searchTimer: ReturnType<typeof setTimeout> | undefined
	let searchSeq = 0

	let rowHeight = $state(16)
	let touch = $state(false)
	let scroller = $state<HTMLDivElement>()
	let dialog = $state<HTMLDialogElement>()
	let selected = $state<number | null>(null)
	let toast = $state('')
	let toastTimer: ReturnType<typeof setTimeout> | undefined

	const marks = $derived(table && matches.length ? markMatches(table, matches) : null)

	const rows = $derived.by(() => {
		void foldVersion
		if (!table) return new Int32Array(0) as Int32Array
		return buildRows(table, folding, filterMatches && marks ? marks : null)
	})

	const lineDigits = $derived(table ? String(table.lines).length : 1)
	const currentNode = $derived(matches.length ? matches[current] : -1)

	const virtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
		count: 0,
		getScrollElement: () => scroller ?? null,
		estimateSize: () => rowHeight,
		overscan: 12,
	})

	// The only effect: hand the virtualizer the current row count / size
	$effect(() => {
		const count = rows.length
		const size = rowHeight
		get(virtualizer).setOptions({
			count,
			getScrollElement: () => scroller ?? null,
			estimateSize: () => size,
		})
	})

	onMount(() => {
		touch = matchMedia('(hover: none)').matches
		rowHeight = matchMedia('(pointer: coarse)').matches ? 22 : 16

		let cancelled = false
		parseJson(text).then(
			(result) => {
				if (cancelled) return
				if (result.table.lines > AUTO_FOLD_LINES) setDepth(AUTO_FOLD_DEPTH, false)
				timing = { parseMs: result.parseMs, flattenMs: result.flattenMs }
				table = result.table
			},
			(e) => {
				if (cancelled || (e instanceof DOMException && e.name === 'AbortError')) return
				failed = e instanceof Error ? e.message : String(e)
			},
		)

		return () => {
			cancelled = true
			clearTimeout(searchTimer)
			clearTimeout(toastTimer)
		}
	})

	/* folding */

	function refold() {
		foldVersion++
	}

	function setDepth(limit: number, bump = true) {
		folding.depthLimit = limit
		folding.toggled.clear()
		depthLimit = limit
		if (bump) refold()
	}

	function toggle(i: number) {
		if (!table) return
		setCollapsed(table, i, !isCollapsed(table, i, folding), folding)
		refold()
	}

	/* search */

	function onQueryInput() {
		clearTimeout(searchTimer)
		searchTimer = setTimeout(runSearch, SEARCH_DEBOUNCE_MS)
	}

	async function runSearch() {
		clearTimeout(searchTimer)
		const q = query.trim()
		const seq = ++searchSeq

		if (!q || !table) {
			matches = new Int32Array(0)
			searched = ''
			return
		}

		const found = await searchJson(q)
		if (seq !== searchSeq || !table) return

		if (found.length <= REVEAL_ALL_LIMIT) {
			for (const i of found) revealNode(table, i, folding)
		}

		searched = q
		matches = found
		current = 0
		refold()
		if (found.length) await goToMatch(0)
	}

	async function goToMatch(index: number) {
		if (!table || !matches.length) return
		current = (index + matches.length) % matches.length
		const node = matches[current]
		if (revealNode(table, node, folding)) refold()
		await tick()
		const rowIndex = rows.indexOf(node)
		if (rowIndex >= 0) get(virtualizer).scrollToIndex(rowIndex, { align: 'center' })
	}

	function onSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault()
			if (query.trim() !== searched) runSearch()
			else goToMatch(current + (event.shiftKey ? -1 : 1))
		} else if (event.key === 'Escape') {
			query = ''
			runSearch()
		}
	}

	/* copying */

	function flash(message: string) {
		toast = message
		clearTimeout(toastTimer)
		toastTimer = setTimeout(() => (toast = ''), 1500)
	}

	/**
	 * Copy text that may still be computing (e.g. pretty JSON from the worker). A pending
	 * ClipboardItem keeps the click's user activation in Safari; elsewhere writeText after the await.
	 */
	async function copy(value: string | Promise<string>, label: string) {
		try {
			if (typeof value !== 'string' && 'ClipboardItem' in window && navigator.clipboard?.write) {
				const blob = value.then((t) => new Blob([t], { type: 'text/plain' }))
				await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })])
			} else {
				await navigator.clipboard.writeText(await value)
			}
			flash(`Copied ${label}`)
		} catch {
			flash('Copy failed')
		}
	}

	function copyValue(i: number) {
		if (!table) return
		const t = table
		copy(t.type[i] <= T_ARRAY ? stringifyJson(i) : valueOf(t, i), 'value')
	}

	function copyPath(i: number) {
		if (!table) return
		copy(pathOf(table, i) || '(root)', 'path')
	}

	function download() {
		const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
		const a = Object.assign(document.createElement('a'), { href: url, download: fileName })
		a.click()
		setTimeout(() => URL.revokeObjectURL(url), 1000)
	}

	async function showRaw() {
		view = 'raw'
		if (rawPretty === null && text.length <= RAW_INLINE_BYTES && !failed) {
			rawPretty = await stringifyJson(0)
		}
	}

	/* row interactions */

	let pressTimer: ReturnType<typeof setTimeout> | undefined
	let pressOrigin: { x: number; y: number } | null = null
	let pressed = false

	function inspect(i: number) {
		selected = i
		dialog?.showModal()
	}

	function onPointerDown(event: PointerEvent, i: number) {
		if (event.pointerType === 'mouse') return
		pressed = false
		pressOrigin = { x: event.clientX, y: event.clientY }
		clearTimeout(pressTimer)
		pressTimer = setTimeout(() => {
			pressed = true
			inspect(i)
		}, LONG_PRESS_MS)
	}

	function onPointerMove(event: PointerEvent) {
		if (
			pressOrigin &&
			Math.hypot(event.clientX - pressOrigin.x, event.clientY - pressOrigin.y) > 8
		) {
			clearTimeout(pressTimer)
			pressOrigin = null
		}
	}

	function onPointerEnd() {
		clearTimeout(pressTimer)
		pressOrigin = null
	}

	function onRowClick(event: MouseEvent, i: number) {
		if (pressed) {
			// The long press already opened the menu; swallow the click that follows it
			pressed = false
			event.preventDefault()
			return
		}
		// Links, copy buttons and live toggles handle their own clicks
		if ((event.target as Element).closest('a[href], .actions, .toggle[tabindex="0"]')) return
		if (!table) return

		if (table.type[i] <= T_ARRAY && table.size[i]) return toggle(i)

		const value = (event.currentTarget as Element).querySelector('.v')
		const truncated = value && value.scrollWidth > value.clientWidth
		if (touch || truncated) inspect(i)
	}

	/* rendering helpers */

	/** Summaries scan children, and every visible row re-renders per scroll frame: compute once */
	const summaries = new Map<number, string>()

	function summary(t: JsonTable, i: number) {
		let text = summaries.get(i)
		if (text === undefined) summaries.set(i, (text = summarize(t, i)))
		return text
	}

	function summarize(t: JsonTable, i: number) {
		const n = t.size[i]
		if (t.type[i] === T_ARRAY) return `[${n} ${n === 1 ? 'item' : 'items'}]`

		const hints: string[] = []
		for (
			let c = i + 1, seen = 0;
			c < t.end[i] && seen < 60 && hints.length < 2;
			c = t.end[c], seen++
		) {
			if (t.type[c] <= T_ARRAY || !HINT_KEYS.includes(keyOf(t, c))) continue
			const v = valueOf(t, c)
			hints.push(
				`${keyOf(t, c)}: ${t.type[c] === T_STRING ? JSON.stringify(v.length > 32 ? v.slice(0, 31) + '…' : v) : v}`,
			)
		}
		return `{${n} ${n === 1 ? 'key' : 'keys'}${hints.length ? ` · ${hints.join(', ')}` : ''}}`
	}

	function display(t: JsonTable, i: number) {
		const v = valueOf(t, i)
		return t.type[i] === T_STRING ? JSON.stringify(v) : v
	}

	/** [before, match, after] around the first case-insensitive occurrence of the search */
	function split(textValue: string): [string, string, string] | null {
		if (!searched) return null
		const at = textValue.toLowerCase().indexOf(searched.toLowerCase())
		if (at < 0) return null
		return [
			textValue.slice(0, at),
			textValue.slice(at, at + searched.length),
			textValue.slice(at + searched.length),
		]
	}

	/** Everything one row slot shows; the slot's elements stay the same, only these values change */
	function rowModel(
		t: JsonTable,
		r: number,
		fold: Folding,
		found: Uint8Array | null,
		currentMatch: number,
	) {
		const close = r < 0
		const i = close ? ~r : r
		const type = t.type[i]
		const p = t.parent[i]
		const comma = i === 0 || t.end[i] === t.end[p] ? '' : ','
		const container = type <= T_ARRAY
		const expandable = !close && container && t.size[i] > 0
		const collapsed = expandable && isCollapsed(t, i, fold)
		const inArray = p >= 0 && t.type[p] === T_ARRAY

		let key = ''
		let value = ''
		let valueClass = 'v'
		let trailing = comma
		let href: string | undefined

		if (close) {
			trailing = (type === T_OBJECT ? '}' : ']') + comma
		} else {
			if (p >= 0) key = inArray ? `${t.index[i]}: ` : `${JSON.stringify(keyOf(t, i))}: `

			if (!container) {
				value = display(t, i)
				valueClass = `v t${type}`
				if (isLink(t, i)) {
					href = valueOf(t, i)
					valueClass += ' link'
				}
			} else if (collapsed) {
				value = summary(t, i)
				valueClass = 'v summary'
			} else if (!t.size[i]) {
				value = type === T_OBJECT ? '{}' : '[]'
				valueClass = 'v p'
			} else {
				value = type === T_OBJECT ? '{' : '['
				valueClass = 'v p'
				trailing = ''
			}
		}

		return {
			i,
			close,
			line: close ? t.closeLine[i] : t.line[i],
			depth: t.depth[i],
			indent: INDENTS[Math.min(t.depth[i], INDENTS.length - 1)],
			expandable,
			collapsed,
			glyph: expandable ? (collapsed ? '▸' : '▾') : '',
			key,
			keyClass: inArray ? 'idx' : 'k',
			value,
			valueClass,
			href,
			trailing,
			match: !close && found !== null && (found[i] & 1) === 1,
			current: !close && i === currentMatch,
		}
	}

	/** Indentation is text (two spaces a level) so changing depth never touches a style attribute */
	const INDENTS = Array.from({ length: 64 }, (_, d) => '  '.repeat(d))

	const isLink = (t: JsonTable, i: number) =>
		t.type[i] === T_STRING && t.vals.startsWith('/api/', t.valOff[i])

	const selectedInfo = $derived.by(() => {
		if (selected === null || !table) return null
		const t = table
		const i = selected
		return {
			path: pathOf(t, i) || '(root)',
			container: t.type[i] <= T_ARRAY,
			value: t.type[i] <= T_ARRAY ? summary(t, i) : valueOf(t, i),
			link: isLink(t, i) ? valueOf(t, i) : null,
			type: ['object', 'array', 'string', 'number', 'boolean', 'null'][t.type[i]],
		}
	})
</script>

{#snippet highlighted(textValue: string)}
	{@const parts = split(textValue)}
	{#if parts}{parts[0]}<mark>{parts[1]}</mark>{parts[2]}{:else}{textValue}{/if}
{/snippet}

<div class="json-viewer flex min-h-0 flex-1 flex-col" data-json-ready={table ? '' : undefined}>
	<div
		class="toolbar flex flex-wrap items-center gap-[.5ch] border-b border-white/15 p-[.5ch] text-xs"
	>
		<div class="flex" role="group" aria-label="View">
			<button
				type="button"
				class={['tool icon', view === 'tree' && 'active']}
				aria-pressed={view === 'tree'}
				aria-label="Tree view"
				title="Tree view"
				onclick={() => (view = 'tree')}><ListUnorderedIcon /></button
			>
			<button
				type="button"
				class={['tool icon', view === 'raw' && 'active']}
				aria-pressed={view === 'raw'}
				aria-label="Raw JSON"
				title="Raw JSON"
				onclick={showRaw}><CodeIcon /></button
			>
		</div>

		{#if view === 'tree'}
			<label class="search flex min-w-0 grow basis-[16ch] items-center gap-[.5ch]">
				<span class="sr-only">Search keys and values</span>
				<input
					class="h-full min-w-0 grow bg-transparent px-[.5ch] outline-none"
					type="search"
					placeholder="Search keys & values"
					enterkeyhint="search"
					autocomplete="off"
					spellcheck="false"
					bind:value={query}
					oninput={onQueryInput}
					onkeydown={onSearchKeydown}
					disabled={!table}
				/>
				{#if searched}
					<output class="shrink-0 text-white/60 tabular-nums" aria-live="polite">
						{matches.length ? `${current + 1}/${matches.length.toLocaleString()}` : '0 matches'}
					</output>
				{/if}
			</label>

			<div class="flex" role="group" aria-label="Matches">
				<button
					type="button"
					class="tool icon"
					aria-label="Previous match"
					title="Previous match (Shift+Enter)"
					disabled={!matches.length}
					onclick={() => goToMatch(current - 1)}><ArrowUpIcon /></button
				>
				<button
					type="button"
					class="tool icon"
					aria-label="Next match"
					title="Next match (Enter)"
					disabled={!matches.length}
					onclick={() => goToMatch(current + 1)}><ArrowUpIcon class="rotate-180" /></button
				>
				<button
					type="button"
					class={['tool icon', filterMatches && 'active']}
					aria-pressed={filterMatches}
					aria-label="Only matching rows"
					title="Only matching rows"
					disabled={!matches.length}
					onclick={() => {
						filterMatches = !filterMatches
						goToMatch(current)
					}}><FilterIcon /></button
				>
			</div>

			<div class="flex items-center" role="group" aria-label="Folding">
				<button
					type="button"
					class="tool icon"
					aria-label="Expand all"
					title="Expand all"
					disabled={!table}
					onclick={() => setDepth(Infinity)}><ExpandVerticalIcon /></button
				>
				<button
					type="button"
					class="tool icon"
					aria-label="Collapse all"
					title="Collapse all"
					disabled={!table}
					onclick={() => setDepth(1)}><CollapseVerticalIcon /></button
				>
				<label class="tool depth flex items-center gap-[.5ch]" title="Expand to depth">
					<span>Depth</span>
					<select
						class="bg-transparent outline-none"
						disabled={!table}
						value={Number.isFinite(depthLimit) ? String(depthLimit) : ''}
						onchange={(e) => {
							const v = e.currentTarget.value
							setDepth(v ? Number(v) : Infinity)
						}}
					>
						<option value="">all</option>
						{#each [1, 2, 3, 4, 5, 6] as depth}
							<option value={String(depth)}>{depth}</option>
						{/each}
					</select>
				</label>
			</div>
		{/if}

		<div class="ml-auto flex">
			<button
				type="button"
				class="tool icon"
				aria-label="Copy full response"
				title="Copy full response"
				disabled={!table && !failed}
				onclick={() => copy(failed ? text : stringifyJson(0), 'response')}><CopyIcon /></button
			>
			<button
				type="button"
				class="tool icon"
				aria-label="Download .json"
				title="Download {fileName}"
				onclick={download}><DownloadIcon /></button
			>
		</div>
	</div>

	{#if failed}
		<div class="p-ch text-sm">
			<p class="text-[#ff9492]">Response isn't valid JSON: {failed}</p>
			<pre class="mt-ch overflow-auto text-xs whitespace-pre-wrap">{text.slice(0, 20_000)}</pre>
		</div>
	{:else if view === 'raw'}
		<div class="min-h-0 flex-1 overflow-auto p-ch text-xs max-sm:max-h-[70svh]">
			{#if text.length > RAW_INLINE_BYTES}
				<p class="mb-ch text-white/70">
					This response is {(text.length / 1024).toFixed(0)} KB; too big to show as plain text.
				</p>
				<button type="button" class="action" onclick={download}>
					<DownloadIcon />
					{fileName}
				</button>
			{:else if rawPretty === null}
				<JsonSkeleton lines={8} />
			{:else}
				<pre class="break-all whitespace-pre-wrap">{rawPretty}</pre>
			{/if}
		</div>
	{:else if !table}
		<JsonSkeleton />
	{:else}
		{@const t = table}
		{@const items = $virtualizer.getVirtualItems()}
		<div
			bind:this={scroller}
			class="list min-h-0 flex-1 overflow-auto overscroll-contain font-mono text-xs max-sm:max-h-[70svh]"
			style:--row={`${rowHeight}px`}
			style:--ln={`${lineDigits + 1}ch`}
			role="tree"
			aria-label="Response JSON"
		>
			<div class="relative w-full" style:height={`${$virtualizer.getTotalSize()}px`}>
				<!--
					Rows are fixed-shape slots that only swap text while scrolling (unkeyed, one shared
					translate). Inserting elements would make Blink re-check the site's many :has() rules
					on <html>/<body>, which restyled ~700 elements per frame.
				-->
				<div class="rows" style:transform={`translateY(${items[0]?.start ?? 0}px)`}>
					{#each items as item}
						{@const m = rowModel(t, rows[item.index], folding, marks, currentNode)}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<div
							class="row"
							class:match={m.match}
							class:current={m.current}
							class:close={m.close}
							role="treeitem"
							tabindex="-1"
							aria-level={m.depth + 1}
							aria-expanded={m.expandable ? !m.collapsed : undefined}
							aria-selected={m.current}
							onclick={(e) => !m.close && onRowClick(e, m.i)}
							oncontextmenu={(e) => {
								if (m.close) return
								e.preventDefault()
								inspect(m.i)
							}}
							onpointerdown={(e) => !m.close && onPointerDown(e, m.i)}
							onpointermove={onPointerMove}
							onpointerup={onPointerEnd}
							onpointercancel={onPointerEnd}
						>
							<span class="ln" aria-hidden="true">{m.line}</span>
							<span class="indent" aria-hidden="true">{m.indent}</span>
							<button
								type="button"
								class="toggle"
								tabindex={m.expandable ? 0 : -1}
								aria-hidden={!m.expandable}
								aria-label={m.collapsed ? 'Expand' : 'Collapse'}
								onclick={() => m.expandable && toggle(m.i)}>{m.glyph}</button
							>
							<span class={m.keyClass}
								>{#if searched}{@render highlighted(m.key)}{:else}{m.key}{/if}</span
							>
							<a class={m.valueClass} href={m.href}
								>{#if searched}{@render highlighted(m.value)}{:else}{m.value}{/if}</a
							>
							<span class="p">{m.trailing}</span>
							{#if !touch}
								<span class="actions">
									<button
										type="button"
										aria-label="Copy value"
										title="Copy value"
										disabled={m.close}
										onclick={() => copyValue(m.i)}><CopyIcon /></button
									>
									<button
										type="button"
										aria-label="Copy path"
										title="Copy path"
										disabled={m.close}
										onclick={() => copyPath(m.i)}><PathIcon /></button
									>
								</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</div>

		<p class="hint border-t border-white/15 px-ch py-[.5ch] text-[11px] text-white/50">
			{[
				`${t.lines.toLocaleString()} lines`,
				`${rows.length.toLocaleString()} shown`,
				timing && `parsed in ${Math.round(timing.parseMs + timing.flattenMs)} ms`,
				touch
					? 'Tap a value or long-press any row to copy it'
					: 'Hover a row to copy its value or path; right-click for details',
			]
				.filter(Boolean)
				.join(' · ')}
		</p>
	{/if}

	<p class="sr-only" role="status">{toast}</p>
	{#if toast}
		<p class="toast" aria-hidden="true">{toast}</p>
	{/if}
</div>

<dialog
	bind:this={dialog}
	class="inspector"
	onclose={() => (selected = null)}
	onclick={(e) => e.target === dialog && dialog?.close()}
>
	{#if selectedInfo && selected !== null}
		{@const node = selected}
		<div class="grid gap-ch p-ch text-sm">
			<header class="flex items-start justify-between gap-ch">
				<code class="text-xs break-all text-[#72f088]">{selectedInfo.path}</code>
				<small class="shrink-0 text-white/50">{selectedInfo.type}</small>
			</header>
			<pre
				class="max-h-[40svh] overflow-auto bg-white/5 p-ch text-xs break-all whitespace-pre-wrap">{selectedInfo.value}</pre>
			{#if selectedInfo.link}
				<a class="sheet-action" href={selectedInfo.link} onclick={() => dialog?.close()}
					>Open {selectedInfo.link}</a
				>
			{/if}
			{#if selectedInfo.container && table && table.size[node]}
				<button
					type="button"
					class="sheet-action"
					onclick={() => {
						toggle(node)
						dialog?.close()
					}}
				>
					{isCollapsed(table, node, folding) ? 'Expand' : 'Collapse'}
				</button>
			{/if}
			<menu class="flex gap-[.5ch]">
				<li class="grid grow">
					<button
						type="button"
						class="sheet-action"
						aria-label="Copy {selectedInfo.container ? 'JSON' : 'value'}"
						title="Copy {selectedInfo.container ? 'JSON' : 'value'}"
						onclick={() => copyValue(node)}><CopyIcon /></button
					>
				</li>
				<li class="grid grow">
					<button
						type="button"
						class="sheet-action"
						aria-label="Copy path"
						title="Copy path"
						onclick={() => copyPath(node)}><PathIcon /></button
					>
				</li>
				<li class="grid">
					<button
						type="button"
						class="sheet-action aspect-square"
						aria-label="Close"
						title="Close"
						onclick={() => dialog?.close()}><CloseIcon /></button
					>
				</li>
			</menu>
		</div>
	{/if}
</dialog>

<style>
	.json-viewer {
		--bg: #0a0c10;
		--fg: #f0f3f6;
		--key: #72f088;
		--string: #addcff;
		--number: #91cbff;
		--guide: rgb(240 243 246 / 0.12);
		position: relative;
		background: var(--bg);
		color: var(--fg);
	}

	/* Focus: accent outline; the Depth box outlines as a whole, not just its <select> */
	.json-viewer :global(:focus-visible:not(.outline-none)),
	.inspector :global(:focus-visible:not(.outline-none)),
	.depth:focus-within {
		outline: 1px solid var(--key, #72f088);
		outline-offset: -1px;
	}

	.tool {
		display: inline-flex;
		align-items: center;
		min-height: 2rem;
		padding-inline: 1ch;
		border: 1px solid rgb(255 255 255 / 0.2);
		white-space: nowrap;

		&:disabled {
			opacity: 0.4;
			cursor: default;
		}

		&.active {
			background: rgb(114 240 136 / 0.2);
		}

		/* touch "hover" sticks after a tap */
		@media (hover: hover) {
			&:not(:disabled):hover {
				background: rgb(114 240 136 / 0.2);
			}
		}

		& + & {
			border-left: 0;
		}

		&.icon {
			justify-content: center;
			min-width: 2rem;
			padding-inline: 0;

			@media (pointer: coarse) {
				min-width: 2.75rem;
			}
		}

		:global(svg) {
			width: 1.15em;
			height: 1.15em;
		}

		@media (pointer: coarse) {
			min-height: 2.75rem;
		}
	}

	.search {
		min-height: 2rem;
		border: 1px solid rgb(255 255 255 / 0.2);
		padding-right: 0.5ch;

		&:focus-within {
			border-color: var(--key);
		}

		input {
			/* 16px stops iOS from zooming into the field */
			font-size: max(16px, 1em);

			@media (pointer: fine) {
				font-size: inherit;
			}
		}

		@media (pointer: coarse) {
			min-height: 2.75rem;
		}
	}

	.list {
		/* not `strict`: the list sizes to its rows until the panel's max height kicks in */
		contain: content;
	}

	.row {
		display: flex;
		align-items: center;
		width: 100%;
		height: var(--row);
		line-height: var(--row);
		white-space: pre;
		padding-right: 1ch;

		@media (hover: hover) {
			&:hover {
				background: rgb(255 255 255 / 0.05);
			}
		}

		&.match {
			background: rgb(255 223 93 / 0.12);
		}

		&.current {
			background: rgb(255 223 93 / 0.28);
		}
	}

	.ln {
		flex-shrink: 0;
		width: var(--ln);
		margin-right: 1ch;
		text-align: right;
		color: rgb(240 243 246 / 0.25);
		user-select: none;
	}

	.indent {
		flex-shrink: 0;
		align-self: stretch;
		background-image: repeating-linear-gradient(to right, var(--guide) 0 1px, transparent 1px 2ch);
		background-position: 0.5ch 0;
	}

	.toggle {
		flex-shrink: 0;
		align-self: stretch;
		width: 2ch;
		text-align: center;
		color: rgb(240 243 246 / 0.6);

		@media (pointer: coarse) {
			width: 3ch;
		}
	}

	.k {
		flex-shrink: 0;
		color: var(--key);
	}

	.idx {
		flex-shrink: 0;
		color: rgb(240 243 246 / 0.35);
	}

	.p {
		flex-shrink: 0;
		color: var(--fg);
	}

	.v {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.t2 {
		color: var(--string);
	}

	.t3,
	.t4,
	.t5 {
		color: var(--number);
	}

	.summary {
		color: rgb(240 243 246 / 0.55);
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	mark {
		background: rgb(255 223 93 / 0.85);
		color: #000;
	}

	.actions {
		display: none;
		margin-left: auto;
		padding-left: 1ch;
		gap: 0.5ch;
		flex-shrink: 0;

		button {
			display: grid;
			place-items: center;
			width: 2.5ch;
			height: calc(var(--row) - 2px);
			border: 1px solid rgb(255 255 255 / 0.25);
			background: var(--bg);

			:global(svg) {
				width: 1.1em;
				height: 1.1em;
			}

			&:hover {
				border-color: var(--key);
			}
		}
	}

	.row:hover .actions,
	.row:focus-within .actions {
		display: flex;
	}

	.row.close .actions {
		visibility: hidden;
	}

	.toast {
		position: absolute;
		right: 1ch;
		bottom: 1ch;
		padding: 0.25ch 1ch;
		background: var(--key);
		color: #000;
		font-size: 0.75rem;
		pointer-events: none;
	}

	.inspector {
		margin: auto auto 0;
		width: 100%;
		max-width: 40rem;
		background: #0a0c10;
		color: #f0f3f6;
		border: 1px solid rgb(255 255 255 / 0.2);
		padding-bottom: env(safe-area-inset-bottom);

		&::backdrop {
			background: rgb(0 0 0 / 0.6);
		}

		@media (width >= 40rem) {
			margin: auto;
		}
	}

	.sheet-action {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 2.75rem;
		padding-inline: 1ch;
		border: 1px solid rgb(255 255 255 / 0.25);
		text-align: center;
		word-break: break-all;

		:global(svg) {
			width: 1.25rem;
			height: 1.25rem;
		}

		&:hover {
			border-color: var(--key, #72f088);
		}
	}
</style>
