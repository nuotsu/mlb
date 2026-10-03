<script lang="ts">
	import { formatDate, getToday } from '#lib/temporal.js'
	import { ChevronRightIcon } from '$ui/icons'

	const links: { label: string; href: string }[] = [
		{
			label: 'Schedule',
			href: `/schedule/week/${formatDate(getToday(), { locale: 'en-CA' })}?sportId=51`,
		},
		{ label: 'Standings', href: '/standings/2026?sportId=51&gameType=P' },
		{ label: 'Stats', href: '/stats/2026?sportId=51&gameType=P' },
	]
</script>

<aside
	class="items-between relative flex grid-cols-[1fr_auto_1fr] items-center justify-between bg-[#006e3c]/25 px-ch py-[.25ch] text-center before:m-auto md:grid dark:bg-[#006e3c]/80 not-dark:text-[#006e3c]"
>
	<div class="flex flex-wrap items-center justify-center gap-x-[2ch] gap-y-[.25ch]">
		<span>World Baseball Classic:</span>

		<div class="flex items-center justify-center gap-x-ch">
			{#each links as { label, href }}
				<a
					class="inline-flex items-center leading-tight font-bold text-balance decoration-dashed hover:underline"
					{href}
				>
					{label}
					<ChevronRightIcon class="inline-block size-lh align-top" />
				</a>
			{/each}
		</div>
	</div>

	<img
		class="-my-ch ml-auto size-[2.5lh]"
		src="https://midfield.mlbstatic.com/v1/league/wbc/spots/72"
		width="72"
		height="72"
		alt="WBC"
	/>
</aside>
