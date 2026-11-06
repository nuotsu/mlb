<script lang="ts">
	import SeasonInfo from '#ui/season/season-info.svelte'
	import Widget from '../widget.svelte'
	import type { WidgetData } from './index.js'

	let { data }: { data: WidgetData } = $props()
</script>

{#if data.season}
	<Widget title="{data.season.seasonId} season" href="/schedule/week" linkLabel="Schedule">
		<SeasonInfo season={data.season} heading={false} showFavoriteTeams />
	</Widget>
{:else}
	<Widget title="Season" href="/schedule/week" linkLabel="Schedule">
		<p class="text-sm text-current/60">Season dates aren't available right now.</p>
	</Widget>
{/if}
