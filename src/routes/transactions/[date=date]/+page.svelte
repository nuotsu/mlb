<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { fetchTransactions } from '$lib/fetch'
	import { formatDate } from '$lib/temporal'
	import Empty from '$ui/empty.svelte'
	import Header from '$ui/header.svelte'
	import { ArrowsDiffIcon } from '$ui/icons'
	import Metadata from '$ui/metadata.svelte'
	import WeekPicker from '$ui/schedule/week-picker.svelte'
	import SelectTeam from '$ui/select-team.svelte'
	import Logo from '$ui/team/logo.svelte'
	import ToggleAllDetails from '$ui/toggle-all-details.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	let currentDate = $derived(page.params.date!)
	let transactions = $derived(data.transactions)

	async function onDateChange(date: string) {
		goto(`/transactions/${date}`, {})
		transactions = await fetchTransactions({ date: currentDate })
	}

	function processTransactions({ transactions }: MLB.TransactionsResponse) {
		const processed = new Set<number>()
		return transactions.filter((t) => {
			if (processed.has(t.id)) return false
			processed.add(t.id)
			return true
		})
	}

	function sortByTeam(a: MLB.Transaction, b: MLB.Transaction) {
		const aTeam = a.toTeam as MLB.Team
		const bTeam = b.toTeam as MLB.Team
		return aTeam?.name.localeCompare(bTeam?.name ?? '') ?? 0
	}
</script>

<Metadata title="Transactions | MLB.TheOhtani.com" description="MLB transactions" />

<Header title="Transactions" crumbs={[{ name: 'Transactions' }]}>
	{#snippet after()}
		<div class="mx-auto flex flex-wrap items-center justify-center gap-ch text-center">
			<SelectTeam class="button grow" />
			<WeekPicker class="grow" date={currentDate} {onDateChange} href="/transactions" />
			<ToggleAllDetails />
		</div>
	{/snippet}
</Header>

<section class="space-y-px py-lh sm:px-ch">
	{#if processTransactions(transactions).length > 0}
		{#each Map.groupBy(processTransactions(transactions), (t) => t.date) as [date, txns] (date)}
			<details class="accordion" open>
				<summary class="sticky-below-header z-1 backdrop-blur-xs">
					{formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}
				</summary>

				<article class="flex flex-wrap gap-x-ch gap-y-[.5ch] px-ch">
					<label class="-order-1 ml-auto">
						<input
							name={date}
							value="all"
							type="radio"
							checked={page.url.searchParams.has('teamId')}
						/>
						All ({txns.length})
					</label>

					{#each Map.groupBy(txns, (t) => t.typeDesc) as [typeDesc, ts], i}
						<label class="order-first">
							<input name={date} type="radio" checked={i === 0} />
							{typeDesc} ({ts.length})
						</label>

						<ul class="w-full anim-fade">
							{#each ts.sort(sortByTeam) as { id, toTeam, fromTeam, person, description } (id)}
								<li class="grid grid-cols-[auto_1fr] gap-x-ch border-b border-current/10 py-1">
									<span class="flex items-center">
										{#if toTeam}
											<Logo class="size-lh" team={toTeam!} />
										{/if}
										{#if fromTeam}
											<ArrowsDiffIcon class="size-ch text-current/50" />
											<Logo class="size-lh" team={fromTeam!} />
										{/if}
									</span>

									{#if person}
										<a class="decoration-dashed hover:underline" href={`/player/${person?.id}`}>
											{description}
										</a>
									{:else}
										<p>{description}</p>
									{/if}
								</li>
							{/each}
						</ul>
					{/each}
				</article>
			</details>
		{/each}
	{:else}
		<Empty>No transactions</Empty>
	{/if}
</section>

<style>
	label:not(:has(:checked)) + ul {
		display: none;
	}

	label:has([value='all']:checked) ~ ul {
		display: block !important;
	}
</style>
