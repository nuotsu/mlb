<script lang="ts">
	import { formatDate, slash } from '$lib/temporal'
	import ToggleFavorite from '$ui/favorites/toggle-favorite.svelte'
	import Header from '$ui/header.svelte'
	import Metadata from '$ui/metadata.svelte'
	import Headshot from '$ui/player/headshot.svelte'
	import RosterEntries from '$ui/player/roster-entries.svelte'
	import HotColdZones from '$ui/stats/hot-cold-zones.svelte'
	import YearByYearList from '$ui/stats/year-by-year-list.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	let person = $derived(
		data.person as MLB.Person & {
			currentTeam: MLB.Team
			preferredTeam?: { team: MLB.Team }
			stats: MLB.PlayerStats[]
			rosterEntries: MLB.Roster[]
		},
	)

	const team = $derived(person.active ? person.currentTeam : person.preferredTeam?.team)

	const isPitcher = $derived(person.primaryPosition?.abbreviation === 'P')
</script>

<Metadata title="{person.fullName} | MLB.TheOhtani.com" description="{person.fullName} profile" />

<Header
	crumbs={[
		{ href: '/player', name: 'Players' },
		team?.id ? { href: `/teams/${team.id}`, name: team?.name } : {},
		{ name: person.fullName },
	]}
>
	<div class="flex flex-wrap items-end gap-ch">
		<Headshot
			class="size-[3lh] shrink-0 rounded-none bg-transparent"
			{person}
			size={240}
			type={person.active ? 'silo' : 'spots'}
		/>

		<h1 class="grid">
			<span>{person.useName || person.firstName}</span>
			<strong class="text-3xl">{person.useLastName || person.lastName}</strong>
		</h1>
	</div>

	{#snippet after()}
		<div class="ml-auto">
			<ToggleFavorite target={{ href: `/player/${person.id}`, label: person.lastName! }} />
		</div>
	{/snippet}
</Header>

<div class="space-y-lh">
	<section class="space-y-lh">
		<header class="grid items-center gap-y-ch md:grid-cols-2">
			<figure class="max-md:mask-b-from-25% md:mask-r-from-50%">
				<img
					class="w-full opacity-0 transition-opacity duration-600"
					src="https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:action:hero:current.jpg/w_1200,q_auto:best/v1/people/{person.id}/action/hero/current"
					width={1200}
					height={400}
					alt=""
					draggable="false"
					loading="eager"
					fetchpriority="high"
					onload={(e) => {
						e.currentTarget.classList.remove('opacity-0')
					}}
				/>
			</figure>

			<dl class="mx-auto description-list max-w-max px-ch">
				{#if person.primaryNumber}
					<dt>Jersey Number</dt>
					<dd>
						#{person.primaryNumber}
					</dd>
				{/if}

				{#if person.primaryPosition}
					<dt>Position</dt>
					<dd>
						{person.primaryPosition.abbreviation}
					</dd>
				{/if}

				{#if person.birthDate}
					<dt>Birth Date</dt>
					<dd>
						{formatDate(slash(person.birthDate), {
							month: 'long',
							day: 'numeric',
							year: 'numeric',
						})}

						<small class="inline-block text-current/50">
							({person.currentAge} years old)
						</small>
					</dd>
				{/if}

				{#if person.birthCity}
					<dt>Birth City</dt>
					<dd>
						{person.birthCity}, {person.birthCountry}
					</dd>
				{/if}
			</dl>
		</header>
	</section>

	{#if person.rosterEntries}
		<section>
			<RosterEntries rosterEntries={person.rosterEntries} />
		</section>
	{/if}

	<section class="group/stats space-y-lh px-ch">
		<nav class="flex items-center justify-center gap-ch">
			<label>
				<input type="radio" name="stat-group" value="hitting" checked={!isPitcher} />
				Hitting
			</label>

			<label>
				<input type="radio" name="stat-group" value="pitching" checked={isPitcher} />
				Pitching
			</label>
		</nav>

		<div class="grid items-start gap-x-lh gap-y-[2lh] md:grid-cols-2">
			<article>
				<h2 class="text-center text-sm text-current/50">Year-by-year Stats</h2>
				<YearByYearList {person} data-group="hitting" />
			</article>

			<article data-group="pitching">
				{#if data.hittingHotColdZones}
					<HotColdZones
						hotColdZones={data.hittingHotColdZones}
						baseballStats={data.baseballStats}
						data-group="hitting"
					/>
				{/if}
				{#if data.pitchingHotColdZones}
					<HotColdZones
						hotColdZones={data.pitchingHotColdZones}
						baseballStats={data.baseballStats}
						data-group="pitching"
					/>
				{/if}
			</article>
		</div>
	</section>
</div>

<style>
	section:has([value='hitting']:not(:checked)) :global([data-group='hitting']),
	section:has([value='pitching']:not(:checked)) :global([data-group='pitching']) {
		display: none;
	}
</style>
