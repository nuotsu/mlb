<script module lang="ts">
	export const SPOILER_LAYOUTS = ['tiles', 'picker', 'list'] as const
	export type SpoilerLayout = (typeof SPOILER_LAYOUTS)[number]
</script>

<script lang="ts">
	import { cn } from '#lib/utils.js'
	import { CloseIcon, EyeOffIcon } from '#ui/icons/index.js'
	import { spoilerPreventionStore } from '#ui/spoiler-prevention/store.svelte.js'
	import Logo from '#ui/team/logo.svelte'
	import { onMount } from 'svelte'
	import { byDivision, mlbTeams } from './mlb-teams.svelte.js'

	let { layout = 'tiles' }: { layout?: SpoilerLayout } = $props()

	// Protected teams live in localStorage; swap them in after hydration
	let mounted = $state(false)
	onMount(() => (mounted = true))

	let protectedTeams = $derived(mounted ? spoilerPreventionStore.teams : [])
	let teams = $derived(mounted ? mlbTeams() : undefined)
	let names = $derived(new Map(teams?.map((t) => [t.id, t.name])))
	let unprotected = $derived(teams?.filter((t) => !spoilerPreventionStore.has(t.id)) ?? [])

	function toTarget(team: MLB.Team): App.SpoilerPrevention {
		return { id: team.id, abbreviation: team.abbreviation ?? team.teamName ?? team.name }
	}

	function add(id: number) {
		const team = teams?.find((t) => t.id === id)
		if (team) spoilerPreventionStore.add(toTarget(team))
	}
</script>

<section class="space-y-ch">
	<header class="flex items-baseline justify-between gap-ch">
		<h2 class="h3">Spoiler prevention</h2>
		{#if protectedTeams.length}
			<small class="text-xs text-current/60 tabular-nums">{protectedTeams.length}</small>
		{/if}
	</header>

	<p class="text-sm text-current/60">
		Scores and results for these teams stay hidden until you reveal them.
	</p>

	{#if layout === 'picker'}
		{#if teams?.length}
			<div class="grid gap-ch sm:grid-cols-2">
				{#each byDivision(teams) as division (division.name)}
					<fieldset class="space-y-[.5ch]">
						<legend class="text-[x-small] tracking-widest text-current/50 uppercase">
							{division.name}
						</legend>
						<div class="grid grid-cols-5 gap-[.5ch]">
							{#each division.teams as team (team.id)}
								{@const on = spoilerPreventionStore.has(team.id)}
								<button
									class={cn(
										'relative grid aspect-square place-items-center rounded bg-current/5 transition-[opacity,box-shadow,transform] active:scale-95',
										on
											? 'ring-2 ring-accent ring-offset-1 ring-offset-background'
											: 'opacity-70 grayscale hover:opacity-100 hover:grayscale-0',
									)}
									aria-pressed={on}
									title="{on ? 'Show' : 'Hide'} scores for the {team.name}"
									onclick={() => spoilerPreventionStore.toggle(toTarget(team))}
								>
									<Logo class="size-3/5" {team} />
									{#if on}
										<EyeOffIcon
											class="absolute -top-1 -right-1 size-4 rounded-full bg-accent p-px text-dark"
										/>
									{/if}
								</button>
							{/each}
						</div>
					</fieldset>
				{/each}
			</div>
		{:else}
			<p class="text-sm text-current/60">{teams ? "Couldn't load teams." : 'Loading…'}</p>
		{/if}
	{:else}
		{#if layout === 'tiles' && protectedTeams.length}
			<ul class="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-[.5ch]">
				{#each protectedTeams as team (team.id)}
					<li
						class="group/spoiler relative isolate flex anim-fade-to-r items-center gap-[.5ch] overflow-hidden rounded bg-current/5 p-ch before:opacity-15"
						style:--team-bg="url(https://midfield.mlbstatic.com/v1/team/{team.id}/spots/32)"
					>
						<Logo class="size-7" team={{ id: team.id } as MLB.Team} />
						<a
							class="min-w-0 grow truncate text-sm font-bold decoration-dashed hover:underline"
							href="/teams/{team.id}"
							title={names.get(team.id)}
						>
							{team.abbreviation}
							<span class="absolute inset-0"></span>
						</a>
						{@render remove(
							team,
							'relative size-6 rounded opacity-0 group-hover/spoiler:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100',
						)}
					</li>
				{/each}
			</ul>
		{:else if layout === 'list' && protectedTeams.length}
			<ul class="divide-y divide-current/10 border-y border-current/10">
				{#each protectedTeams as team (team.id)}
					<li class="flex min-h-11 items-center gap-ch py-[.5ch]">
						<a class="group/spoiler flex min-w-0 grow items-center gap-ch" href="/teams/{team.id}">
							<Logo class="size-8" team={{ id: team.id } as MLB.Team} />
							<div class="min-w-0">
								<p class="truncate text-sm decoration-dashed group-hover/spoiler:underline">
									{names.get(team.id) ?? team.abbreviation}
								</p>
								<p class="text-xs text-current/60">{team.abbreviation}</p>
							</div>
						</a>
						<button
							class="tap shrink-0 text-xs link"
							onclick={() => spoilerPreventionStore.remove(team.id)}
						>
							Show scores
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		<label class="flex items-center gap-ch text-sm">
			<span class="sr-only">Hide scores for a team</span>
			<select
				class="input min-h-11 w-full rounded px-ch"
				disabled={!unprotected.length}
				onchange={(e) => {
					add(Number(e.currentTarget.value))
					e.currentTarget.value = ''
				}}
			>
				<option value="" selected>
					{teams
						? unprotected.length
							? 'Hide scores for a team…'
							: 'All teams hidden'
						: 'Loading teams…'}
				</option>
				{#each unprotected as team (team.id)}
					<option value={team.id}>{team.name}</option>
				{/each}
			</select>
		</label>
	{/if}
</section>

{#snippet remove(team: App.SpoilerPrevention, className: string)}
	<button
		class={cn(
			'tap grid shrink-0 place-items-center text-current/50 transition-colors hover:bg-current/10 hover:text-current',
			className,
		)}
		onclick={() => spoilerPreventionStore.remove(team.id)}
		aria-label="Show scores for {names.get(team.id) ?? team.abbreviation}"
		title="Show scores"
	>
		<CloseIcon />
	</button>
{/snippet}

<style>
	/* At least 44px of tap target around small buttons */
	.tap {
		position: relative;

		&::before {
			content: '';
			position: absolute;
			inset: min(0px, calc((100% - 44px) / 2));
		}
	}
</style>
