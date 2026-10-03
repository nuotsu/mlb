<script lang="ts">
	import { cn } from '#lib/utils.js'
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		person,
		size = 96,
		type = 'spots',
		class: className,
		...props
	}: {
		person: Partial<MLB.Person>
		size?: number
		type?: 'spots' | 'silo'
	} & HTMLAttributes<HTMLImageElement> = $props()
</script>

<img
	class={cn(
		'img-fade block object-contain text-transparent opacity-0 transition-opacity',
		type !== 'silo' && 'rounded-full bg-foreground/10',
		className,
	)}
	src="https://midfield.mlbstatic.com/v1/people/{person.id}/{type}/{size}"
	width={size}
	height={size}
	alt={person.fullName ?? ''}
	draggable="false"
	onload={(e) => {
		e.currentTarget.classList.remove('opacity-0')
	}}
	{...props}
/>
