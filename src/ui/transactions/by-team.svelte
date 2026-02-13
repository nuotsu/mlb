<script lang="ts">
	import Empty from '$ui/empty.svelte'
	import { favoritesStore } from '$ui/favorites/store.svelte'
	import Transaction from '$ui/transactions/transaction.svelte'
	import { processTransactions } from '$ui/transactions/utils'

	let {
		transactions,
	}: {
		transactions: MLB.Transaction[]
	} = $props()

	const txns = $derived(processTransactions(transactions))

	const teams = $derived(
		txns
			.map((t) => t.toTeam ?? t.fromTeam)
			.filter(Boolean)
			.filter((team, i, arr) => arr.findIndex((t) => t?.id === team?.id) === i)
			.sort((a, b) => a?.name.localeCompare(b?.name ?? '') ?? 0),
	)

	const favoriteTeamIds = $derived(
		favoritesStore.favorites
			.filter((f) => f.href.includes('team'))
			.map((f) => Number(f.href.split('/').pop())),
	)

	let teamId = $derived<number | 'all'>(
		favoriteTeamIds.find((id) => txns.some((t) => t.toTeam?.id === id)) ??
			'all',
	)

	const filteredTxns = $derived(
		txns.filter((t) => {
			if (teamId === 'all') return true
			return t.toTeam?.id === teamId || t.fromTeam?.id === teamId
		}),
	)
</script>

<div class="border border-stroke">
	<label aria-label="Select team">
		<select class="button w-full" bind:value={teamId}>
			<option value="all">All teams ({txns.length})</option>
			{#each teams as team (team?.id)}
				{@const count = txns.filter(
					(t) => t.toTeam?.id === team?.id || t.fromTeam?.id === team?.id,
				).length}
				<option value={team?.id}>
					{team?.name} ({count})
				</option>
			{/each}
		</select>
	</label>

	<div class="h-[20ch] overflow-y-auto px-ch py-[.5ch]">
		{#if filteredTxns.length}
			<ul>
				{#each filteredTxns as transaction (transaction.id)}
					<Transaction class="anim-fade" {transaction} />
				{/each}
			</ul>
		{:else}
			<Empty class="m-auto h-full">No transactions for today</Empty>
		{/if}
	</div>
</div>
