<script lang="ts">
	import { goto } from '$app/navigation'
	import { resolveQuery } from '$lib/quick-search'
	import { cn } from '$lib/utils'
	import { SearchIcon } from '$ui/icons'

	let { class: className }: { class?: string } = $props()

	let query = $state('')
	let resolving = $state(false)

	async function onsubmit(event: SubmitEvent) {
		event.preventDefault()

		const q = query.trim()
		if (!q || resolving) return

		resolving = true
		try {
			await goto(await resolveQuery(q))
		} finally {
			resolving = false
		}
	}
</script>

<search class={cn('relative', className)}>
	<form role="search" {onsubmit}>
		<label class="grid *:col-span-full *:row-span-full">
			<SearchIcon class="mx-[.5ch] my-auto size-lh shrink-0" />

			<input
				name="query"
				class={cn('input h-[1.5lh] min-w-0 px-ch pl-[1.5lh]', resolving && 'animate-pulse')}
				type="search"
				placeholder={`Try "boxscore for today's Dodgers game"`}
				aria-label="Jump to a game, player, team, or page"
				aria-busy={resolving}
				bind:value={query}
			/>
		</label>

		<button class="sr-only" type="submit">Go</button>
	</form>
</search>
