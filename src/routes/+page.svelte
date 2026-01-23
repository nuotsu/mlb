<script lang="ts">
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
</script>

<Metadata
	title="MLB.TheOhtani.com"
	description="A custom MLB scorebug for Major League Baseball (MLB) and other leagues."
/>

<header class="p-ch">
	<h1 class="mx-auto flex max-w-max flex-col text-center" aria-label="Welcome to MLB.TheOhtani.com">
		<div class="-mb-ch">Welcome to</div>
		<pre
			class="overflow-x-auto overflow-y-clip font-mono text-[xx-small] leading-none">{ascii}</pre>
		<p class="ml-auto">.TheOhtani.com</p>
	</h1>
</header>

<SeasonInfo />
