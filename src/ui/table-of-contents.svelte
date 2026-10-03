<script lang="ts">
	import { cn } from '#lib/utils.js'
	import type { HTMLAttributes } from 'svelte/elements'

	let { class: className }: HTMLAttributes<HTMLDivElement> = $props()

	let headings: {
		id: string
		text: string
		level: number
	}[] = $state([])

	$effect(() => {
		const article = document.querySelector('article')
		if (!article) return

		const elements = article.querySelectorAll('h2, h3, h4')
		headings = Array.from(elements).map((el) => ({
			id: el.id || '',
			text: el.textContent || '',
			level: parseInt(el.tagName[1]),
		}))
	})
</script>

{#if headings.length > 0}
	<nav class="grid gap-ch {className}">
		<h2
			class="max-w-max bg-background text-xs tracking-widest text-current/50 uppercase max-md:-mt-lh max-md:px-ch"
		>
			Table of Contents
		</h2>

		<ul>
			{#each headings as heading (heading.id)}
				<li
					class={cn(
						{
							3: 'pl-ch',
							4: 'pl-[2ch]',
						}[heading.level],
					)}
				>
					<a href="#{heading.id}" class="hover:underline">
						{heading.text}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
{/if}
