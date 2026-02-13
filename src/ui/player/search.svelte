<script lang="ts">
	import { dev } from '$app/environment'
	import { page } from '$app/state'
	import { fetchMLB } from '$lib/fetch'
	import { count, debounce } from '$lib/utils'
	import Empty from '$ui/empty.svelte'
	import { SearchIcon } from '$ui/icons'
	import Loading from '$ui/loading.svelte'
	import Headshot from '$ui/player/headshot.svelte'
	import posthog from 'posthog-js'

	let { class: className }: { class?: string } = $props()

	let query = $state(page.url.searchParams.get('query') ?? '')
	let promise: Promise<any> | null = $state(null)

	function search() {
		const q = query?.trim() ?? ''

		if (q.length < 3 || !/^[a-zA-Z-.\s]+$/.test(q)) {
			promise = null
			return
		}

		promise = fetchMLB('/api/v1/people/search', {
			names: query,
			fields: 'people,id,fullName,primaryNumber,primaryPosition,abbreviation',
		}).then((results) => {
			if (!dev) posthog.capture('player_search_query', { query })
			return results
		})
	}

	$effect(() => {
		if (page) search()
	})

	const searchActionSchema = {
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
	}
</script>

<svelte:head>
	{@html `<script type="application/ld+json">${JSON.stringify(searchActionSchema)}<\/script>`}
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
				oninput={debounce(search)}
			/>
		</label>
	</form>

	{#if promise}
		<output for="query" class="absolute inset-x-0 top-full block px-ch">
			<div
				class="max-h-[14lh] overflow-y-auto border border-stroke px-ch py-[.5ch] backdrop-blur-xs"
			>
				{#await promise}
					<Loading class="p-ch">Searching players...</Loading>
				{:then results}
					{#if results.people.length}
						<div class="text-sm text-current/50">
							{count(results.people.length, 'player')} found
						</div>

						<ul>
							{#each results.people as person (person.id)}
								<li>
									<a class="group/player flex items-center gap-ch py-1" href="/player/{person.id}">
										<Headshot {person} size={48} class="size-[1.5lh] shrink-0" />

										<small class="inline-block w-[3ch] text-center">
											{person.primaryPosition.abbreviation}
										</small>

										<span class="decoration-dashed group-hover/player:underline">
											{person.fullName}
										</span>

										{#if person.primaryNumber}
											<span class="text-current/50">#{person.primaryNumber}</span>
										{/if}
									</a>
								</li>
							{/each}
						</ul>
					{:else}
						<Empty>No players found</Empty>
					{/if}
				{/await}
			</div>
		</output>
	{/if}
</search>
