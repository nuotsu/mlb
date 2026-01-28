<script lang="ts">
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()
</script>

<section class="p-ch">
	<ul>
		{#each data.teams.teams.sort((a, b) => a.name.localeCompare(b.name)) as team}
			{@const src = `https://midfield.mlbstatic.com/v1/team/${team.id}/spots`}

			<li>
				<a
					class="flex items-center gap-ch decoration-dashed hover:underline"
					href="/teams/{team.id}"
				>
					<img
						class="size-lh text-transparent"
						src="https://www.mlbstatic.com/team-logos/team-cap-on-dark/{team.id}.svg"
						alt={team.name}
						width="300"
						height="300"
						draggable="false"
						onerror={(e) => {
							;(e.currentTarget as HTMLImageElement).src = `${src}/72`
						}}
					/>

					{team.name}
				</a>
			</li>
		{/each}
	</ul>
</section>
