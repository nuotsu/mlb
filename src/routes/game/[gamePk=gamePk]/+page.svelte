<script lang="ts">
	import Game from '$ui/game/game.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	const game = $derived(data.game.dates[0].games[0])
	const boxscore = $derived(data.boxscore)
	const linescore = $derived(data.linescore)
</script>

<section class="mx-auto max-w-5xl p-ch">
	<Game {game} {boxscore} {linescore} />
</section>
