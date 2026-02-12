<script lang="ts">
	import { dev } from '$app/environment'
	import { EyeIcon, EyeOffIcon } from '$ui/icons'
	import { spoilerPreventionStore } from '$ui/spoiler-prevention/store.svelte'
	import posthog from 'posthog-js'

	let {
		team,
	}: {
		team: App.SpoilerPrevention
	} = $props()

	let checked = $derived(spoilerPreventionStore.has(team.id))

	function toggle() {
		spoilerPreventionStore.toggle(team)

		if (!checked && !dev) {
			posthog.capture('spoiler_prevention_added', { teamId: team.id })
		}
	}
</script>

<label
	class="group/spoiler text-current/50 transition-colors *:size-lh has-checked:text-accent"
	title="Toggle spoiler prevention"
>
	<input class="sr-only" type="checkbox" value={team.id} {checked} onchange={toggle} />

	<EyeIcon class=" group-has-checked/spoiler:hidden" />
	<EyeOffIcon class=" group-not-has-checked/spoiler:hidden" />
</label>
