<script lang="ts">
	import { fetchWeekTransactions } from '#lib/fetch/presets.js'
	import { formatDate, getToday, slash } from '#lib/temporal.js'
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import Empty from '$ui/empty.svelte'
	import Header from '$ui/header.svelte'
	import Metadata from '$ui/metadata.svelte'
	import SelectWeek from '$ui/schedule/select-week.svelte'
	import SelectTeam from '$ui/select-team.svelte'
	import ToggleAllDetails from '$ui/toggle-all-details.svelte'
	import TransactionList from '$ui/transactions/transaction-list.svelte'
	import { processTransactions } from '$ui/transactions/utils'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	let currentDate = $derived(page.params.date!)
	let transactions = $derived(data.transactions)

	async function onDateChange(date: string) {
		goto(`/transactions/${date}`, {})
		transactions = await fetchWeekTransactions({ date: currentDate })
	}

	const processedTransactions = $derived(processTransactions(transactions.transactions))
</script>

<Metadata title="Transactions | MLB.TheOhtani.com" description="MLB transactions" />

<Header title="Transactions" crumbs={[{ name: 'Transactions', href: '/transactions' }]}>
	{#snippet after()}
		<div class="mx-auto flex flex-wrap items-center justify-center gap-ch text-center">
			<SelectTeam class="button grow text-center" />
			<SelectWeek class="grow" date={currentDate} onchange={onDateChange} href="/transactions" />
			<ToggleAllDetails />
		</div>
	{/snippet}
</Header>

<section class="space-y-px py-lh sm:px-ch">
	{#if processedTransactions.length > 0}
		{#each Map.groupBy(processedTransactions, (t) => t.date) as [date, txns] (date)}
			<details class="accordion" open={formatDate(slash(date)) === formatDate(getToday())}>
				<summary class="sticky-below-header z-1 backdrop-blur-xs">
					{formatDate(slash(date), { weekday: 'short', month: 'short', day: 'numeric' })}

					{#if formatDate(slash(date)) === formatDate(getToday())}
						<small class="dark:text-accent not-dark:positive">Today</small>
					{/if}
				</summary>

				<TransactionList
					transactions={txns}
					name={date}
					defaultChecked={page.url.searchParams.has('teamId') ? 'all' : false}
				/>
			</details>
		{/each}
	{:else}
		<Empty>No transactions</Empty>
	{/if}
</section>
