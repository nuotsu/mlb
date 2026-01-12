<script lang="ts">
	let { parameter, values, form } = $props()

	let input = $derived(form?.entries[parameter] ?? values[0]?.value ?? '')

	let isDateInput = $derived(['date', 'updatedSince'].includes(parameter))
</script>

<tr class="align-top *:px-[.5ch]">
	<th class="sticky left-0 bg-background text-right font-normal">
		<label for={parameter} class="grid h-lh items-center">
			<small class="flex justify-end font-mono">
				{parameter}
				<span class="text-current/25">=</span>
			</small>
		</label>
	</th>

	<td class="px-[3px]!">
		<input
			class="field-sizing-content w-full max-w-[24ch] min-w-[6ch] input px-[.5ch] text-center tabular-nums"
			id={parameter}
			name={parameter}
			bind:value={input}
			placeholder={values[0]?.value}
			type={isDateInput ? 'date' : 'search'}
		/>
	</td>

	<td>
		<div class="flex flex-wrap gap-x-ch">
			{#each values as { value, label }}
				{#if label}
					<label class="whitespace-nowrap">
						<input
							type="radio"
							name="{parameter}-presets"
							checked={value === input}
							data-target={parameter}
							onchange={() => (input = value)}
						/>
						{label}
					</label>
				{/if}
			{/each}
		</div>
	</td>
</tr>
