<script lang="ts">
	import { fetchMLB } from '$lib/fetch'
	import { debounce } from '$lib/utils'
	import { IconIcon } from '$ui/icons'
	import Loading from '$ui/loading.svelte'
	import Metadata from '$ui/metadata.svelte'
	import Headshot from '$ui/player/headshot.svelte'
	import posthog from 'posthog-js'

	let query = $state('')
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
</script>

<Metadata title="Player Search | MLB.TheOhtani.com" description="Search for a player by name" />

<search class="space-y-ch p-ch">
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
					{#each results.people as person}
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
