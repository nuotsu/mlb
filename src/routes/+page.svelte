<script lang="ts">
	import { formatDate, getToday } from '$lib/temporal'
	import Metadata from '$ui/metadata.svelte'
	import SeasonInfo from '$ui/season/season-info.svelte'
	import TransactionByTeam from '$ui/transactions/by-team.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	const ascii = `
$$\\      $$\\ $$\\       $$$$$$$\\
$$$\\    $$$ |$$ |      $$  __$$\\
$$$$\\  $$$$ |$$ |      $$ |  $$ |
$$\\$$\\$$ $$ |$$ |      $$$$$$$\\ |
$$ \\$$$  $$ |$$ |      $$  __$$\\
$$ |\\$  /$$ |$$ |      $$ |  $$ |
$$ | \\_/ $$ |$$$$$$$$\\ $$$$$$$  |
\\__|     \\__|\\________|\\_______/
`

	const today = formatDate(getToday(), { weekday: 'long', month: 'long', day: 'numeric' })
</script>

<Metadata
	title="MLB.TheOhtani.com"
	description="A custom MLB scorebug for Major League Baseball (MLB) and other leagues. MLB = Mitchell's Live scoreBug."
/>

<div class="flex h-full flex-col space-y-[2lh] px-ch py-[2lh] before:m-auto after:m-auto">
	<header class="space-y-ch text-xl">
		<h1 class="mx-auto flex max-w-max flex-col" aria-label="Welcome to MLB.TheOhtani.com">
			<div class="leading-1">Welcome to</div>
			<pre class="overflow-x-auto overflow-y-clip text-[x-small] leading-none">{ascii}</pre>
			<p class="ml-auto">.TheOhtani.com</p>
		</h1>

		<p class="text-center italic">
			Track MLB games, explore stats, and query the Stats API, all in one app.
		</p>
	</header>

	<SeasonInfo />

	<section class="space-y-ch">
		<h2 class="text-center h1">{today}</h2>

		<TransactionByTeam transactions={data.transactions.transactions} />
	</section>
</div>
