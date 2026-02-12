<script lang="ts">
	import { spoilerPreventionStore } from '$ui/spoiler-prevention/store.svelte'
	import Logo from '$ui/team/logo.svelte'
</script>

<details class="accordion-base" open={!!spoilerPreventionStore.teams?.length}>
	<summary class="hover-link">Spoiler Prevention</summary>

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
		<div class="text-center text-current/40">No spoiler prevention</div>
	{/if}
</details>
