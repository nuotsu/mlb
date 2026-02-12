<script lang="ts">
	import { formatDate, getToday } from '$lib/temporal'
	import Metadata from '$ui/metadata.svelte'
	import SeasonInfo from '$ui/season/season-info.svelte'

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

<div class="flex h-full flex-col space-y-[2lh] px-ch before:m-auto after:m-auto">
	<header class="pt-lh">
		<h1 class="mx-auto flex max-w-max flex-col" aria-label="Welcome to MLB.TheOhtani.com">
			<div class="-mb-ch">Welcome to</div>
			<pre class="overflow-x-auto overflow-y-clip text-[xx-small] leading-none">{ascii}</pre>
			<p class="ml-auto">.TheOhtani.com</p>
		</h1>
	</header>

	<section class="flex justify-center">
		<article>
			<h2 class="h1">{today}</h2>
		</article>
	</section>

	<SeasonInfo />
</div>
