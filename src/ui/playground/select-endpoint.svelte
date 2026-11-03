<script lang="ts">
	import { cn } from '#lib/utils.js'
	import { onMount, tick } from 'svelte'
	import { CUSTOM_ENDPOINT_KEY, DIRECTORY, ENDPOINTS } from './constants'

	let {
		value,
		onselect,
	}: {
		value: string
		/** Fires when the user picks a different endpoint */
		onselect: (endpoint: string) => void
	} = $props()

	interface Option {
		key: string
		group: string
		description: string
	}

	const OPTIONS: Option[] = [
		{
			key: CUSTOM_ENDPOINT_KEY,
			group: 'Custom',
			description: ENDPOINTS[CUSTOM_ENDPOINT_KEY].description ?? '',
		},
		...Object.entries(DIRECTORY).flatMap(([group, endpoints]) =>
			Object.entries(endpoints).map(([key, { description = '' }]) => ({ key, group, description })),
		),
	]

	const id = 'endpoint-combobox'

	let mounted = $state(false)
	let open = $state(false)
	let query = $state('')
	let active = $state(0)
	let input = $state<HTMLInputElement>()
	let list = $state<HTMLUListElement>()

	onMount(() => (mounted = true))

	/**
	 * Fuzzy score: every whitespace-separated token must appear in the path (as a substring, or
	 * failing that as an in-order subsequence) or in the description. Higher is better; 0 = no match.
	 */
	function score(option: Option, tokens: string[]) {
		const path = option.key.toLowerCase()
		const description = option.description.toLowerCase()
		let total = 0

		for (const token of tokens) {
			const at = path.indexOf(token)
			if (at >= 0) {
				// Prefer matches at a segment boundary (`/sched` over `...schedule` mid-word)
				total += 100 + (path[at - 1] === '/' || path[at - 1] === '{' ? 50 : 0) - at / 10
				continue
			}

			const gaps = subsequenceGaps(path, token)
			if (gaps >= 0) {
				total += Math.max(10, 60 - gaps)
				continue
			}

			if (description.includes(token)) {
				total += 20
				continue
			}

			return 0
		}

		return total
	}

	/** Characters skipped while matching `needle` in order inside `haystack`, or -1 */
	function subsequenceGaps(haystack: string, needle: string) {
		let gaps = 0
		let h = 0
		for (const char of needle) {
			const at = haystack.indexOf(char, h)
			if (at < 0) return -1
			if (h > 0) gaps += at - h
			h = at + 1
		}
		return gaps
	}

	const results = $derived.by(() => {
		const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
		if (!tokens.length) return OPTIONS

		return OPTIONS.map((option) => ({ option, score: score(option, tokens) }))
			.filter(({ score }) => score > 0)
			.sort((a, b) => b.score - a.score)
			.map(({ option }) => option)
	})

	/** Grouped by category when browsing; a flat ranked list while searching */
	const grouped = $derived(!query.trim())

	async function show() {
		if (open) return
		open = true
		query = ''
		active = Math.max(
			0,
			results.findIndex((o) => o.key === value),
		)
		await tick()
		scrollActive()
	}

	function hide() {
		open = false
		query = ''
	}

	function choose(option: Option | undefined) {
		if (!option) return
		hide()
		if (option.key !== value) onselect(option.key)
	}

	function scrollActive() {
		list?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
	}

	async function move(delta: number | 'start' | 'end') {
		if (!open) return show()
		const count = results.length
		if (!count) return
		active = delta === 'start' ? 0 : delta === 'end' ? count - 1 : (active + delta + count) % count
		await tick()
		scrollActive()
	}

	function onkeydown(event: KeyboardEvent) {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault()
				move(1)
				break
			case 'ArrowUp':
				event.preventDefault()
				move(-1)
				break
			case 'PageDown':
				event.preventDefault()
				move(8)
				break
			case 'PageUp':
				event.preventDefault()
				move(-8)
				break
			case 'Home':
				if (open && !query) {
					event.preventDefault()
					move('start')
				}
				break
			case 'End':
				if (open && !query) {
					event.preventDefault()
					move('end')
				}
				break
			case 'Enter':
				// Never submit the form from here
				event.preventDefault()
				if (open) choose(results[active])
				else show()
				break
			case 'Escape':
				if (open) {
					event.preventDefault()
					hide()
				}
				break
			case 'Tab':
				hide()
				break
		}
	}
</script>

{#if !mounted}
	<!-- No-JS / pre-hydration fallback; the form action handles a changed selection -->
	<select
		name="endpoint-path"
		class="input-dev h-11 w-full min-w-0 font-mono text-sm sm:h-lh sm:w-auto sm:grow"
		aria-label="Endpoint"
		{value}
	>
		<option value={CUSTOM_ENDPOINT_KEY}>{CUSTOM_ENDPOINT_KEY}</option>
		{#each Object.entries(DIRECTORY) as [label, endpoints]}
			<optgroup {label}>
				{#each Object.keys(endpoints) as e}
					<option value={e}>{e}</option>
				{/each}
			</optgroup>
		{/each}
	</select>
{:else}
	<input type="hidden" name="endpoint-path" {value} />

	<div class="relative w-full min-w-0 sm:w-auto sm:grow">
		<input
			bind:this={input}
			class="input-dev h-11 w-full font-mono text-base sm:h-lh sm:text-sm"
			role="combobox"
			aria-label="Endpoint"
			aria-expanded={open}
			aria-controls="{id}-list"
			aria-autocomplete="list"
			aria-activedescendant={open && results[active] ? `${id}-${active}` : undefined}
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
			enterkeyhint="go"
			placeholder={open ? 'Search endpoints, e.g. "sched post" or "roster"' : undefined}
			value={open ? query : value}
			oninput={(e) => {
				query = e.currentTarget.value
				active = 0
				open = true
			}}
			onfocus={show}
			onclick={show}
			onblur={hide}
			{onkeydown}
		/>

		{#if open}
			<ul
				bind:this={list}
				id="{id}-list"
				role="listbox"
				aria-label="Endpoints"
				class="absolute inset-x-0 top-full z-20 max-h-[min(60svh,32rem)] overflow-y-auto overscroll-contain border border-current/25 bg-background shadow-lg sm:min-w-[40ch]"
			>
				{#each results as option, index (option.key)}
					{#if grouped && option.group !== results[index - 1]?.group}
						<li
							role="presentation"
							class="sticky top-0 z-1 bg-background px-ch pt-[.5ch] text-xs text-current/50 uppercase"
						>
							{option.group}
						</li>
					{/if}
					<!-- Keyboard selection happens on the combobox input (aria-activedescendant) -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<li
						id="{id}-{index}"
						data-index={index}
						role="option"
						aria-selected={index === active}
						class={cn(
							'grid min-h-11 cursor-pointer content-center px-ch py-[.5ch] sm:min-h-0',
							index === active && 'bg-accent/25',
							option.key === value && 'font-bold',
						)}
						onpointerdown={(e) => e.preventDefault()}
						onpointermove={() => (active = index)}
						onclick={() => choose(option)}
					>
						<span class="font-mono text-sm break-all">
							{option.key}
							{#if !grouped}
								<small class="ml-[.5ch] font-sans font-normal text-current/50">{option.group}</small
								>
							{/if}
						</span>
						{#if option.description}
							<small class="line-clamp-1 text-current/60">{option.description}</small>
						{/if}
					</li>
				{:else}
					<li class="p-ch text-sm text-current/60" role="presentation">No endpoints match.</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}
