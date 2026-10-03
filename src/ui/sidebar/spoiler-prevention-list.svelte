<script lang="ts">
	import { EyeOffIcon } from '#ui/icons/index.js'
	import { spoilerPreventionStore } from '#ui/spoiler-prevention/store.svelte.js'
	import Logo from '#ui/team/logo.svelte'
	import { browser } from '$app/env'

	let open = $derived(
		!!spoilerPreventionStore.teams?.length &&
			(browser ? localStorage.getItem('sidebar-open') === 'true' : false),
	)
</script>

<details class="accordion-base" bind:open>
	<summary class="hover-link">
		<EyeOffIcon />
		<span class="sm:sidebar-closed-hidden">Spoiler Prevention</span>
	</summary>

	{#if spoilerPreventionStore.teams?.length}
		<ul class="grid grid-cols-2 gap-px text-center">
			{#each spoilerPreventionStore.teams as team (team.id)}
				<li class="anim-fade-to-r">
					<a
						class="group/spoiler relative flex w-full items-center gap-[.5ch] bg-current/5 p-[.25ch] before:opacity-10"
						href="/teams/{team.id}"
						style:--team-bg="url(https://midfield.mlbstatic.com/v1/team/{team.id}/spots/32)"
					>
						<Logo class="size-lh" team={{ id: team.id } as MLB.Team} />

						<span
							class="line-clamp-1 grow break-all decoration-dashed group-hover/spoiler:underline"
						>
							{team.abbreviation}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<div
			class="relative border border-dashed border-stroke p-ch text-center text-xs whitespace-normal text-current/40"
		>
			<p>No spoiler-protections added.</p>
			<p>
				<a class="link" href="/teams">Add a team<span class="absolute inset-0"></span></a>
				to get started.
			</p>
		</div>
	{/if}
</details>
