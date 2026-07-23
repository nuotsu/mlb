<script lang="ts">
	import { formatDate, slash } from '$lib/temporal'

	let {
		person,
	}: {
		person: MLB.Person & {
			relatives?: MLB.Relative[]
		}
	} = $props()
</script>

<dl class="m-auto description-list max-w-max p-ch">
	{#if person.primaryPosition}
		<dt>Position</dt>
		<dd>
			{person.primaryPosition.abbreviation}
		</dd>
	{/if}

	{#if person.primaryNumber}
		<dt>Jersey Number</dt>
		<dd>
			#{person.primaryNumber}
		</dd>
	{/if}

	{#if person.height && person.weight}
		<dt>H/W</dt>
		<dd>
			{person.height} / {person.weight} lbs
		</dd>
	{/if}

	{#if person.batSide && person.pitchHand}
		<dt>Bats / Throws</dt>
		<dd>
			{person.batSide.code} / {person.pitchHand.code}
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
				(Age: {person.currentAge})
			</small>
		</dd>
	{/if}

	{#if person.birthCity}
		<dt>Birth City</dt>
		<dd>
			{person.birthCity}, {person.birthCountry}
		</dd>
	{/if}

	{#if person.mlbDebutDate}
		<dt>MLB Debut</dt>
		<dd>
			<a class="link" href="/schedule/day/{person.mlbDebutDate}">
				{formatDate(slash(person.mlbDebutDate), {
					month: 'long',
					day: 'numeric',
					year: 'numeric',
				})}
			</a>
		</dd>
	{/if}

	{#if person.relatives}
		<div class="contents">
			<dt>Relatives</dt>
			<dd class="flex flex-col items-start">
				{#each person.relatives as { id, fullName, relation } (id)}
					<a class="group/relative" href="/player/{id}">
						<small class="text-current/50">{relation}</small>
						<span class="underline group-not-hover/relative:decoration-dashed">{fullName}</span>
					</a>
				{/each}
			</dd>
		</div>
	{/if}
</dl>
