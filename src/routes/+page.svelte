<script lang="ts">
	import { formatDate, getToday } from '$lib/temporal'
	import Metadata from '$ui/metadata.svelte'
	import CountdownList from '$ui/season/countdown-list.svelte'
	import SeasonInfo from '$ui/season/season-info.svelte'
	import TransactionByTeam from '$ui/transactions/by-team.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()
	let { season } = $derived(data)

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

<div
	class="flex min-h-dvh flex-col justify-center gap-[2lh] px-ch pt-lh pb-[max(1lh,env(safe-area-inset-bottom))]"
>
	<header class="space-y-ch">
		<h1 class="mx-auto flex max-w-max flex-col text-xl" aria-label="Welcome to MLB.TheOhtani.com">
			<div class="leading-none">Welcome to</div>
			<pre class="-mt-ch overflow-x-auto overflow-y-clip text-[x-small] leading-none">{ascii}</pre>
			<p class="ml-auto">.TheOhtani.com</p>
		</h1>

		<p class="text-center text-balance italic">
			Track MLB games, explore stats, and query the Stats API, all in one app.
		</p>
	</header>

	<CountdownList {season} />

	<section class="space-y-ch">
		<h2 class="text-center h1">{today}</h2>

		<article class="[&_ul_p]:text-sm">
			<header class="flex items-center justify-between gap-ch text-sm">
				<h2 class="text-center text-current/50">Recent Transactions</h2>
				<a href="/transactions" class="hover-link">View all</a>
			</header>

			<TransactionByTeam transactions={data.transactions.transactions} />
		</article>
	</section>

	<SeasonInfo {season} />
</div>
