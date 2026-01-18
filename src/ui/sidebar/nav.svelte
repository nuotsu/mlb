<script lang="ts">
	import { formatDate, getToday } from '$lib/temporal'
	import { CalendarTodayIcon, CalendarIcon, JsonIcon } from '$ui/icons'
	import Drawer from './drawer.svelte'

	const today = formatDate(getToday(), {
		locale: 'en-CA',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	})
</script>

<Drawer>
	<div class="flex h-full flex-col gap-ch overflow-clip">
		<div class="sm:sidebar-closed-hidden">
			<a href="/"> MLB.TheOhtani.com </a>
		</div>

		<ul class="[&_span]:sm:sidebar-closed-hidden">
			<li>
				<a href="/schedule" class="flex items-center gap-1">
					<CalendarIcon />
					<span>Weekly Schedule</span>
				</a>
			</li>
			<li>
				<a href="/schedule/{today}" class="flex items-center gap-1">
					<CalendarTodayIcon />
					<span>Today's Games</span>
				</a>
			</li>
			<li>
				<a href="/api/playground" class="flex items-center gap-1">
					<JsonIcon />
					<span>Stats API Playground</span>
				</a>
			</li>
		</ul>

		<ul class="mt-auto text-sm sm:sidebar-closed-hidden">
			<li><a href="https://github.com/nuotsu/mlb">Star on GitHub</a></li>
			<li><a href="https://nuotsu.dev">Built by nuotsu</a></li>
		</ul>
	</div>
</Drawer>

<style>
	div :global(svg) {
		flex-shrink: 0;
		width: 1em;
		height: 1em;
	}
</style>
