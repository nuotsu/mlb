<script lang="ts">
	import { payroll, payrollRank } from '#lib/payroll.js'
	import { formatDate } from '#lib/temporal.js'
	import Divider from '#ui/divider.svelte'
	import Empty from '#ui/empty.svelte'
	import PayrollChart, { type PayrollTeam } from './payroll-chart.svelte'

	let {
		records,
		season,
		regularSeason,
	}: {
		records: MLB.StandingsResponse['records']
		season: string
		/** Payroll is set against regular-season records; spring training's don't line up. */
		regularSeason: boolean
	} = $props()

	const teams = $derived(
		records.flatMap(({ teamRecords }) =>
			teamRecords.flatMap(({ team, wins, losses, winningPercentage }): PayrollTeam[] => {
				const entry = payrollRank(team.id)
				if (!entry) return []

				return [
					{
						team,
						wins,
						losses,
						winningPercentage,
						payroll: entry.payroll,
						luxuryTaxPayroll: entry.luxuryTaxPayroll,
						rank: entry.rank,
					},
				]
			}),
		),
	)
</script>

{#if String(payroll.season) !== season || !payroll.teams.length || !regularSeason || !teams.length}
	<section id="payroll" class="scroll-mt-[calc(var(--header-height,0px)+1ch)] px-ch">
		<Divider>Payroll</Divider>

		<Empty>
			{#if String(payroll.season) !== season}
				Payroll is only available for the {payroll.season} season.
				<a class="link" href="/standings/{payroll.season}#payroll">See {payroll.season}</a>
			{:else if !payroll.teams.length}
				Payroll data hasn't been fetched yet
			{:else if !regularSeason}
				Payroll is compared against regular-season records.
				<a class="link" href="/standings/{season}#payroll">Switch to the regular season</a>
			{:else}
				No standings to compare payroll against
			{/if}
		</Empty>
	</section>
{:else}
	<section id="payroll" class="scroll-mt-[calc(var(--header-height,0px)+1ch)] px-ch">
		<Divider>Payroll vs. Win %</Divider>
		<PayrollChart
			class="mx-auto max-w-4xl"
			{teams}
			chart="scatter"
			threshold={payroll.luxuryTaxThreshold}
		/>
	</section>

	<section id="payroll-by-team" class="scroll-mt-[calc(var(--header-height,0px)+1ch)] px-ch">
		<Divider>Payroll by Team</Divider>
		<figure class="mx-auto grid max-w-4xl gap-lh">
			<PayrollChart {teams} chart="bars" threshold={payroll.luxuryTaxThreshold} />

			<figcaption class="text-center text-xs text-current/50">
				Payroll data via
				<a class="link" href={payroll.source.url} target="_blank" rel="noopener noreferrer">
					{payroll.source.name}</a
				>{#if payroll.lastUpdated}, updated {formatDate(payroll.lastUpdated, {
						month: 'short',
						day: 'numeric',
						year: 'numeric',
					})}{/if}
			</figcaption>
		</figure>
	</section>
{/if}
