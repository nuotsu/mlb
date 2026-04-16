<script lang="ts">
	import { compareStore } from '$ui/compare/store.svelte'
	import { SplitFilledIcon, SplitIcon } from '$ui/icons'

	let { personId, class: className }: { personId: number; class?: string } = $props()

	let checked = $derived(compareStore.has(personId))

	function toggle() {
		compareStore.toggle(personId)
	}
</script>

<label
	class="group/compare flex items-center gap-[.5ch] transition-colors has-checked:text-accent {className}"
	title="Toggle compare"
>
	<input
		class="sr-only"
		type="checkbox"
		{checked}
		onchange={toggle}
	/>

	<SplitIcon class="size-lh group-has-checked/compare:hidden" />
	<SplitFilledIcon class="size-lh group-not-has-checked/compare:hidden" />

	<span class="max-sm:hidden">Compare</span>
</label>
