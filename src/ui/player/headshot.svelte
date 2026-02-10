<script lang="ts">
	let {
		person,
		size = 96,
		type = 'spots',
		class: className,
	}: {
		person: Partial<MLB.Person>
		size?: number
		type?: 'spots' | 'silo'
		class?: string
	} = $props()
</script>

<img
	class="block rounded-full bg-foreground/10 object-contain text-transparent img-fade opacity-0 transition-opacity {className}"
	src="https://midfield.mlbstatic.com/v1/people/{person.id}/{type}/{size}"
	width={size}
	height={size}
	alt={person.fullName ?? ''}
	draggable="false"
	onload={(e) => {
		e.currentTarget.classList.remove('opacity-0')
	}}
/>
