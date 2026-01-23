<script lang="ts">
	import { page } from '$app/state'
	import { fetchMLB } from '$lib/fetch'
	import { debounce } from '$lib/utils'
	import { IconIcon } from '$ui/icons'
	import Loading from '$ui/loading.svelte'
	import Headshot from '$ui/player/headshot.svelte'
	import posthog from 'posthog-js'

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
			fields: 'people,id,fullName,primaryNumber',
		}).then((results) => {
			posthog.capture('player_search_query', { query })
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

<search class="space-y-ch">
	<h1 class="text-center">Player Search</h1>

	<form class="mx-auto max-w-5xl" role="search">
		<label class="grid *:col-span-full *:row-span-full">
			<IconIcon class="mx-[.5ch] my-auto size-lh shrink-0" />

			<input
				name="query"
				class="input h-[1.5lh] w-full px-ch pl-[1.5lh]"
				type="search"
				placeholder="Enter a player name..."
				pattern="\w+"
				bind:value={query}
				oninput={debounce(search)}
			/>
		</label>
	</form>

	{#if promise}
		<output for="query" class="mx-auto block max-w-5xl">
			{#await promise}
				<Loading>Searching players...</Loading>
			{:then results}
				<ul>
					{#each results.people as person (person.id)}
						<li>
							<a class="flex gap-ch decoration-dashed hover:underline" href="/player/{person.id}">
								<Headshot {person} size={36} class="size-lh shrink-0" />

								{person.fullName}

								{#if person.primaryNumber}
									<span>#{person.primaryNumber}</span>
								{/if}
							</a>
						</li>
					{/each}
				</ul>
			{/await}
		</output>
	{/if}
</search>
