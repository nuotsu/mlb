<script lang="ts">
	import ToggleCompare from '$ui/compare/toggle-compare.svelte'
	import ToggleFavorite from '$ui/favorites/toggle-favorite.svelte'
	import Header from '$ui/header.svelte'
	import Metadata from '$ui/metadata.svelte'
	import Draft from '$ui/player/draft.svelte'
	import GameLog from '$ui/player/game-log.svelte'
	import Headshot from '$ui/player/headshot.svelte'
	import HotColdZonesList from '$ui/player/hot-cold-zones-list.svelte'
	import PlayerInfo from '$ui/player/player-info.svelte'
	import RosterEntries from '$ui/player/roster-entries.svelte'
	import SeasonSplits from '$ui/player/season-splits.svelte'
	import YearByYearList from '$ui/stats/year-by-year-list.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	let person = $derived(
		data.person as MLB.Person & {
			currentTeam: MLB.Team
			preferredTeam?: { team: MLB.Team }
			stats: MLB.PlayerStats[]
			rosterEntries: MLB.Roster[]
			drafts: MLB.DraftPick[]
			relatives: MLB.Relative[]
		},
	)

	const team = $derived(person.active ? person.currentTeam : person.preferredTeam?.team)

	const hasGroup = (group: 'hitting' | 'pitching') =>
		!!person.stats?.some(
			(s) =>
				s.type?.displayName === 'yearByYear' &&
				(s.group as unknown as MLB.StatGroupRef)?.displayName === group &&
				s.splits?.length,
		)

	const groups = $derived((['hitting', 'pitching'] as const).filter(hasGroup))

	const isPitcher = $derived(
		['P', 'TWP'].includes(person.primaryPosition?.abbreviation ?? '') ||
			person.primaryPosition?.code === '1',
	)

	/** Pitchers (two-way included) open on pitching; otherwise the first group with data */
	const defaultGroup = $derived(isPitcher && groups.includes('pitching') ? 'pitching' : groups[0])
</script>

<svelte:head>
	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'Person',
		name: person.fullName,
		givenName: person.firstName,
		familyName: person.lastName,
		url: `https://mlb.theohtani.com/player/${person.id}`,
		image: `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${person.id}/headshot/67/current`,
		...(person.birthDate && { birthDate: person.birthDate }),
		...(person.birthCity && {
			birthPlace: { '@type': 'Place', name: `${person.birthCity}, ${person.birthCountry}` },
		}),
		...(team?.name && {
			memberOf: {
				'@type': 'SportsTeam',
				name: team.name,
				url: team.id ? `https://mlb.theohtani.com/teams/${team.id}` : undefined,
			},
		}),
		...(person.primaryPosition?.abbreviation && { jobTitle: person.primaryPosition.abbreviation }),
	})}<\/script>`}
</svelte:head>

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
		<div class="mx-auto flex items-center justify-center gap-ch">
			<ToggleCompare class="text-current/50 [&>span]:hidden" personId={person.id} />
			<ToggleFavorite target={{ href: `/player/${person.id}`, label: person.lastName! }} />
		</div>
	{/snippet}
</Header>

<div class="space-y-lh pb-[max(1lh,env(safe-area-inset-bottom))]">
	<section class="space-y-lh">
		<header class="grid gap-y-ch md:grid-cols-2">
			<figure class="max-md:mask-b-from-25% md:mask-r-from-50%">
				<img
					class="size-full object-cover opacity-0 transition-opacity duration-600"
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

			<PlayerInfo {person} />
		</header>
	</section>

	{#if person.rosterEntries}
		<section
			class="flex items-start gap-ch overflow-x-auto overflow-y-clip px-ch pt-[.5lh] before:m-auto after:m-auto"
		>
			<RosterEntries class="contents!" rosterEntries={person.rosterEntries} />
			<Draft {person} />
		</section>
	{/if}

	{#if groups.length}
		<div class="space-y-lh px-ch">
			<fieldset class="flex justify-center gap-ch">
				<legend class="sr-only">Stats group</legend>

				{#each groups as group (group)}
					<label
						class="button rounded-full capitalize has-checked:border-accent has-checked:bg-accent/25 has-checked:font-bold has-focus-visible:ring-2 has-focus-visible:ring-accent dark:has-checked:text-accent"
					>
						<input
							class="sr-only"
							type="radio"
							name="stats-group"
							value={group}
							checked={group === defaultGroup}
						/>
						{group}
					</label>
				{/each}
			</fieldset>

			{#each groups as group (group)}
				<section class="space-y-lh" data-stats-group={group}>
					<SeasonSplits {group} {person} baseballStats={data.baseballStats} />

					<GameLog {group} {person} baseballStats={data.baseballStats} />

					<div
						class="grid items-start gap-[2lh] md:grid-cols-[repeat(auto-fit,minmax(var(--container-sm),1fr))]"
					>
						<YearByYearList {group} {person} />

						<article class="space-y-lh">
							<HotColdZonesList {group} {person} baseballStats={data.baseballStats} />
						</article>
					</div>
				</section>
			{/each}
		</div>
	{/if}
</div>

<style>
	/* Only the checked pill's section shows; no JS involved */
	fieldset:has([value='hitting']:checked) ~ [data-stats-group='pitching'],
	fieldset:has([value='pitching']:checked) ~ [data-stats-group='hitting'] {
		display: none;
	}
</style>
