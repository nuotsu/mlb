<script lang="ts">
	import Transaction from '$ui/transactions/transaction.svelte'

	let {
		transactions,
		name,
		defaultChecked = false,
		class: className,
	}: {
		transactions: MLB.Transaction[]
		name: string
		defaultChecked?: false | string
		class?: string
	} = $props()

	let grouped = $derived(Map.groupBy(transactions, (t) => t.typeDesc))

	function sortByTeam(a: MLB.Transaction, b: MLB.Transaction) {
		const aTeam = a.toTeam as MLB.Team
		const bTeam = b.toTeam as MLB.Team
		return aTeam?.name.localeCompare(bTeam?.name ?? '') ?? 0
	}
</script>

<article class="flex flex-wrap gap-x-ch gap-y-[.5ch] px-ch {className}">
	{#if grouped?.size > 1}
		<label class="-order-1 mb-ch ml-auto">
			<input {name} value="all" type="radio" checked={defaultChecked === 'all'} />
			All ({transactions.length})
		</label>
	{/if}

	{#each grouped as [typeDesc, ts], i (typeDesc)}
		{#if grouped?.size > 1}
			<label class="order-first">
				<input {name} type="radio" checked={i === 0 && defaultChecked !== 'all'} />
				{typeDesc} ({ts.length})
			</label>
		{/if}

		<ul class="w-full anim-fade">
			{#each ts.sort(sortByTeam) as transaction (transaction.id)}
				<Transaction {transaction} />
			{/each}
		</ul>
	{/each}
</article>

<style>
	label:not(:has(:checked)) + ul {
		display: none;
	}

	label:has([value='all']:checked) ~ ul {
		display: block !important;
	}
</style>
