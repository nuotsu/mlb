<script lang="ts">
	import { COMPARE_STATS, standardKeys, statsFor, type CompareGroup } from '#lib/compare.js'
	import { fetchMLB } from '#lib/fetch/index.js'
	import { getToday } from '#lib/temporal.js'
	import { cn } from '#lib/utils.js'
	import PillSwitcher from '#ui/pill-switcher.svelte'
	import SelectSeason from '#ui/stats/select-season.svelte'
	import { GROUPS, LAYOUTS, SCOPES, type CompareQuery, type LayoutId } from './options'

	let {
		query = $bindable(),
		selected = $bindable(),
		layout = $bindable(),
	}: {
		query: CompareQuery
		selected: Set<string>
		layout: LayoutId
	} = $props()

	const today = getToday()
	const max = `${today.getFullYear() + 1}-12-31`

	let all = $derived(statsFor(query.group))
	let count = $derived(all.filter((s) => selected.has(s.key)).length)

	function setGroup(group: CompareGroup) {
		query.group = group
		selected = new Set(standardKeys(group))
	}

	function toggle(keys: string[], on: boolean) {
		const next = new Set(selected)
		for (const key of keys) {
			if (on) next.add(key)
			else next.delete(key)
		}
		selected = next
	}

	const PRESETS = [
		{ label: 'Standard', keys: () => standardKeys(query.group) },
		{ label: 'All', keys: () => all.map((s) => s.key) },
		{ label: 'None', keys: () => [] },
	]
</script>

<div class="space-y-ch px-ch">
	<div class="flex flex-wrap items-center justify-between gap-ch">
		<PillSwitcher
			class="mx-0"
			id="compare-group"
			aria-label="Stat group"
			options={GROUPS}
			value={query.group}
			controls="compare-results"
			onchange={setGroup}
		/>

		<PillSwitcher
			class="mx-0"
			id="compare-layout"
			aria-label="Layout"
			options={LAYOUTS}
			value={layout}
			controls="compare-results"
			onchange={(next) => (layout = next)}
		/>
	</div>

	<div class="flex flex-wrap items-center gap-ch">
		<select class="button h-lh" aria-label="Stat scope" bind:value={query.scope}>
			{#each SCOPES as { id, label } (id)}
				<option value={id}>{label}</option>
			{/each}
		</select>

		{#if query.scope === 'season' || query.scope === 'projected'}
			<SelectSeason
				class="justify-start"
				aria-label="Season"
				onchange={(e) => (query.season = Number(e.currentTarget.value))}
			/>
		{:else if query.scope === 'dates'}
			<label class="flex items-center gap-[.5ch]">
				<span class="text-current/60">From</span>
				<input class="button" type="date" min="1901-01-01" {max} bind:value={query.startDate} />
			</label>
			<label class="flex items-center gap-[.5ch]">
				<span class="text-current/60">to</span>
				<input class="button" type="date" min={query.startDate} {max} bind:value={query.endDate} />
			</label>
		{:else if query.scope === 'vsTeam'}
			{#await fetchMLB<MLB.TeamsResponse>( '/api/v1/teams', { sportId: '1', fields: ['teams,id,name'] } ) then { teams }}
				<select class="button h-lh" aria-label="Opponent" bind:value={query.opposingTeamId}>
					{#each teams.toSorted((a, b) => a.name.localeCompare(b.name)) as t (t.id)}
						<option value={t.id}>{t.name}</option>
					{/each}
				</select>
			{/await}
		{/if}
	</div>

	<details class="accordion-base border border-stroke">
		<summary class="px-ch py-[.5ch]">
			Stats <span class="text-current/50">{count} of {all.length}</span>
		</summary>

		<div class="space-y-ch border-t border-stroke p-ch">
			<div class="flex flex-wrap gap-[.5ch]">
				{#each PRESETS as preset (preset.label)}
					<button
						class="action-tertiary"
						type="button"
						onclick={() => (selected = new Set(preset.keys()))}
					>
						{preset.label}
					</button>
				{/each}
			</div>

			<div class="grid gap-x-lh gap-y-ch sm:grid-cols-[repeat(auto-fill,minmax(22ch,1fr))]">
				{#each COMPARE_STATS[query.group] as category (category.id)}
					{@const keys = category.stats.map((s) => s.key)}
					{@const on = keys.filter((k) => selected.has(k)).length}
					<fieldset>
						<legend class="flex w-full items-center justify-between gap-ch text-current/60">
							{category.label}
							<button
								class="text-xs link"
								type="button"
								onclick={() => toggle(keys, on < keys.length)}
							>
								{on < keys.length ? 'All' : 'None'}
							</button>
						</legend>

						<div class="flex flex-wrap gap-[.5ch] pt-[.5ch]">
							{#each category.stats as { key, abbr, label } (key)}
								<label
									class={cn(
										'rounded-full border border-current/20 px-[1ch] whitespace-nowrap transition-colors select-none hover:bg-accent/15',
										'has-checked:border-accent has-checked:bg-accent/20',
									)}
									title={label}
								>
									<input
										class="sr-only"
										type="checkbox"
										checked={selected.has(key)}
										onchange={(e) => toggle([key], e.currentTarget.checked)}
									/>
									{abbr}
								</label>
							{/each}
						</div>
					</fieldset>
				{/each}
			</div>
		</div>
	</details>
</div>
