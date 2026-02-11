<script lang="ts">
	import { formatDate, slash } from '$lib/temporal'

	let { person }: { person: MLB.Person } = $props()
</script>

<dl class="mx-auto description-list max-w-max px-ch">
	{#if person.primaryNumber}
		<dt>Jersey Number</dt>
		<dd>
			#{person.primaryNumber}
		</dd>
	{/if}

	{#if person.primaryPosition}
		<dt>Position</dt>
		<dd>
			{person.primaryPosition.abbreviation}
		</dd>
	{/if}

	{#if person.birthDate}
		<dt>Birth Date</dt>
		<dd>
			{formatDate(slash(person.birthDate), {
				month: 'long',
				day: 'numeric',
				year: 'numeric',
			})}

			<small class="inline-block text-current/50">
				({person.currentAge} years old)
			</small>
		</dd>
	{/if}

	{#if person.birthCity}
		<dt>Birth City</dt>
		<dd>
			{person.birthCity}, {person.birthCountry}
		</dd>
	{/if}
</dl>
