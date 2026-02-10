<script lang="ts">
	import ToggleFavorite from '$ui/favorites/toggle-favorite.svelte'
	import Header from '$ui/header.svelte'
	import Metadata from '$ui/metadata.svelte'
	import Headshot from '$ui/player/headshot.svelte'
	import HotColdZones from '$ui/stats/hot-cold-zones.svelte'
	import YearByYearList from '$ui/stats/year-by-year-list.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	let person = $derived(
		data.person as MLB.Person & {
			currentTeam: MLB.Team
			preferredTeam?: { team: MLB.Team }
			stats: MLB.PlayerStats[]
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

<!-- <img
	src="https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:action:hero:current.jpg/w_426,q_auto:best/v1/people/{person.id}/action/hero/current"
	alt=""
/> -->

<section class="space-y-lh px-ch py-lh">
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
	</dl>

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

	<YearByYearList {person} />

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
</section>

<style>
	section:has([value='hitting']:not(:checked)) :global([data-group='hitting']),
	section:has([value='pitching']:not(:checked)) :global([data-group='pitching']) {
		display: none;
	}
</style>
