<script lang="ts">
	import Countdown from './countdown.svelte'

	let { season }: { season: MLB.SeasonDateInfo } = $props()
</script>

<article class="flex flex-wrap justify-center gap-x-[2lh] gap-y-lh">
	<Countdown date={season.springStartDate} until="🌻 Spring Training" />
	<Countdown date="2026-03-04" until="🌎 World Baseball Classic" />
	<Countdown date={season.regularSeasonStartDate} until="🏟️ Opening Day" />
</article>
