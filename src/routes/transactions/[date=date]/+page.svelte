<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { fetchTransactions } from '$lib/fetch'
	import { formatDate } from '$lib/temporal'
	import Empty from '$ui/empty.svelte'
	import Header from '$ui/header.svelte'
	import { ArrowsDiffIcon } from '$ui/icons'
	import Metadata from '$ui/metadata.svelte'
	import Headshot from '$ui/player/headshot.svelte'
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

<Header title="Transactions" crumbs={[{ name: 'Transactions', href: '/transactions' }]}>
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
			{@const grouped = Map.groupBy(txns, (t) => t.typeDesc)}

			<details class="accordion" open>
				<summary class="sticky-below-header z-1 backdrop-blur-xs">
					{formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}
				</summary>

				<article class="flex flex-wrap gap-x-ch gap-y-[.5ch] px-ch">
					{#if grouped?.size > 1}
						<label class="-order-1 mb-ch ml-auto">
							<input
								name={date}
								value="all"
								type="radio"
								checked={page.url.searchParams.has('teamId')}
							/>
							All ({txns.length})
						</label>
					{/if}

					{#each grouped as [typeDesc, ts], i}
						{#if grouped?.size > 1}
							<label class="order-first">
								<input name={date} type="radio" checked={i === 0} />
								{typeDesc} ({ts.length})
							</label>
						{/if}

						<ul class="w-full anim-fade">
							{#each ts.sort(sortByTeam) as { id, toTeam, fromTeam, person, description } (id)}
								<li
									class="group/transaction relative flex items-center gap-ch border-t border-current/15 py-[.5ch]"
								>
									<span class="flex shrink-0 items-center">
										{#if toTeam}
											<Logo class="size-lh" team={toTeam!} />
										{/if}
										{#if fromTeam}
											<ArrowsDiffIcon class="size-ch shrink-0 text-current/50" />
											<Logo class="size-lh" team={fromTeam!} />
										{/if}
									</span>

									{#if person}
										<figure class="shrink-0">
											<Headshot {person} class="size-lh" />
										</figure>
									{/if}

									<p class="leading-tight decoration-dashed group-hover/transaction:underline">
										{description}
									</p>

									{#if person}
										<a class="text-0 absolute inset-0" href="/player/{person.id}">
											{person.fullName}
										</a>
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
