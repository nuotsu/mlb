<script lang="ts">
	import { favoritesStore } from '$ui/favorites/store.svelte'
	import Transaction from '$ui/transactions/transaction.svelte'
	import { processTransactions } from '$ui/transactions/utils'

	let { transactions }: { transactions: MLB.Transaction[] } = $props()

	const txns = $derived(processTransactions(transactions))

	const teams = $derived(
		txns
			.map((t) => t.toTeam ?? t.fromTeam)
			.filter(Boolean)
			.filter((team, i, arr) => arr.findIndex((t) => t?.id === team?.id) === i)
			.sort((a, b) => a?.name.localeCompare(b?.name ?? '') ?? 0),
	)

	const favoriteTeam = $derived(
		favoritesStore.favorites
			.find((f) => f.href.includes('team'))
			?.href?.split('/')
			.pop(),
	)

	let teamId = $derived<number | undefined>(favoriteTeam ? Number(favoriteTeam) : undefined)

	const filteredTxns = $derived(
		txns.filter((t) =>
			isNaN(Number(teamId)) ? true : t.toTeam?.id === teamId || t.fromTeam?.id === teamId,
		),
	)
</script>

<article>
	<h2 class="text-center text-sm text-current/50">Recent Transactions</h2>

	<div class="h-[24ch] overflow-y-auto border border-stroke">
		<select class="sticky top-0 z-1 button block w-full backdrop-blur-xs" bind:value={teamId}>
			<option>All teams ({txns.length})</option>

			{#each teams as team (team?.id)}
				{@const count = txns.filter(
					(t) => t.toTeam?.id === team?.id || t.fromTeam?.id === team?.id,
				).length}

				<option value={team?.id}>
					{team?.name} ({count})
				</option>
			{/each}
		</select>

		<ul class="px-ch py-[.5ch]">
			{#each filteredTxns as transaction (transaction.id)}
				<Transaction class="anim-fade" {transaction} />
			{/each}
		</ul>
	</div>
</article>
