<script lang="ts">
	import { fetchMLB } from '#lib/fetch/index.js'
	import { count, debounce } from '#lib/utils.js'
	import { dev } from '$app/env'
	import { page } from '$app/state'
	import ToggleCompare from '$ui/compare/toggle-compare.svelte'
	import Empty from '$ui/empty.svelte'
	import { SearchIcon } from '$ui/icons'
	import Loading from '$ui/loading.svelte'
	import Headshot from '$ui/player/headshot.svelte'
	import posthog from 'posthog-js'
	import { untrack } from 'svelte'

	let { class: className }: { class?: string } = $props()
	let query = $state(page.url.searchParams.get('query') ?? '')
	let promise: Promise<any> | null = $state(null)
	const oninput = debounce(search)

	function search() {
		const q = query?.trim() ?? ''

		if (q.length < 3 || !/^[a-zA-Z-.\s]+$/.test(q)) {
			promise = null
			return
		}

		promise = fetchMLB('/api/v1/people/search', {
			names: query,
			fields: 'people,id,fullName,primaryNumber,primaryPosition,abbreviation,active',
		}).then((results) => {
			if (!dev) posthog.capture('player_search_query', { query })
			return results
		})
	}

	$effect(() => {
		page.url.searchParams.get('query')
		untrack(search)
	})
</script>

<svelte:head>
	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: 'MLB.TheOhtani.com',
		url: 'https://mlb.theohtani.com',
		potentialAction: {
			'@type': 'SearchAction',
			target: {
				'@type': 'EntryPoint',
				urlTemplate: 'https://mlb.theohtani.com/player?query={search_term_string}',
			},
			'query-input': 'required name=search_term_string',
		},
	})}<\/script>`}
</svelte:head>

<search class="relative space-y-ch {className}">
	<form role="search">
		<label class="grid *:col-span-full *:row-span-full">
			<SearchIcon class="mx-[.5ch] my-auto size-lh shrink-0" />

			<input
				name="query"
				class="input h-[1.5lh] min-w-0 px-ch pl-[1.5lh]"
				type="search"
				placeholder="Search for a player..."
				pattern="\w+"
				bind:value={query}
				{oninput}
			/>
		</label>
	</form>

	{#if promise}
		<output for="query" class="block">
			{#await promise}
				<Loading class="p-ch">Searching players...</Loading>
			{:then results}
				{#if results.people.length}
					<div class="px-ch text-sm text-current/50 max-md:text-center">
						{count(results.people.length, 'player')} found
					</div>

					<ul>
						{#each results.people as person (person.id)}
							<li class="flex items-stretch gap-ch px-ch hover:bg-current/10">
								<a
									class="group/player flex grow items-center gap-ch py-1"
									href="/player/{person.id}"
								>
									<Headshot {person} size={48} class="size-[1lh] shrink-0" />

									<small class="inline-block w-[3ch] shrink-0 text-center">
										{person.primaryPosition.abbreviation}
									</small>

									<span
										class="line-clamp-1 break-all decoration-dashed group-hover/player:underline"
									>
										{person.fullName}
									</span>

									{#if person.primaryNumber}
										<span class="text-current/50">#{person.primaryNumber}</span>
									{/if}

									{#if person.active}
										<small class="text-accent">Active</small>
									{/if}
								</a>

								<ToggleCompare
									class="text-sm not-has-checked:not-hover:text-current/50"
									personId={person.id}
								/>
							</li>
						{/each}
					</ul>
				{:else}
					<Empty>No players found</Empty>
				{/if}
			{/await}
		</output>
	{/if}
</search>
