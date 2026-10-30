<script lang="ts">
	import { payroll, payrollRank } from '#lib/payroll.js'
	import { formatDate } from '#lib/temporal.js'
	import { currentUrl, setViewParam } from '#lib/url.svelte.js'
	import Empty from '#ui/empty.svelte'
	import PillSwitcher from '#ui/pill-switcher.svelte'
	import PayrollChart, { CHARTS, type Chart, type PayrollTeam } from './payroll-chart.svelte'

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

	/** Kept in `?chart=` so a shared link opens the same chart. */
	const chart = $derived<Chart>(
		currentUrl().searchParams.get('chart') === 'bars' ? 'bars' : 'scatter',
	)

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

{#if String(payroll.season) !== season}
	<Empty>
		Payroll is only available for the {payroll.season} season.
		<a class="link" href="/standings/{payroll.season}?view=payroll">See {payroll.season}</a>
	</Empty>
{:else if !payroll.teams.length}
	<Empty>Payroll data hasn't been fetched yet</Empty>
{:else if !regularSeason}
	<Empty>
		Payroll is compared against regular-season records.
		<a class="link" href="?view=payroll{chart === 'bars' ? '&chart=bars' : ''}"
			>Switch to the regular season</a
		>
	</Empty>
{:else if !teams.length}
	<Empty>No standings to compare payroll against</Empty>
{:else}
	<div class="grid gap-ch">
		<PillSwitcher
			id="payroll-chart"
			aria-label="Chart type"
			options={CHARTS}
			value={chart}
			controls="payroll-chart-panel"
			onchange={(next) => setViewParam('chart', next, 'scatter')}
		/>

		<div id="payroll-chart-panel" role="tabpanel" aria-labelledby="payroll-chart-tab-{chart}">
			<figure class="mx-auto grid w-full max-w-4xl gap-ch">
				<PayrollChart {teams} {chart} threshold={payroll.luxuryTaxThreshold} />

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
		</div>
	</div>
{/if}
