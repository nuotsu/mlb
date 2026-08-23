import { addDays, daysBetween, getToday } from '$lib/temporal'

type ILTerm = {
	/** Badge text, e.g. `DTD` or `IL-10` */
	label: string
	/** Minimum days on the IL before the player is activation-eligible */
	days: number | null
}

/**
 * The Stats API reports the IL flavor as a status code. Codes are mapped here;
 * anything unrecognized falls back to reading the description, so a code we
 * haven't seen still renders sensibly.
 */
const IL_TERMS: Record<string, ILTerm> = {
	DTD: { label: 'DTD', days: null },
	D7: { label: 'IL-7', days: 7 },
	D10: { label: 'IL-10', days: 10 },
	D15: { label: 'IL-15', days: 15 },
	D60: { label: 'IL-60', days: 60 },
}

const IL_STATUS = /injured list|day-to-day/i
const IL_ACTIVATION = /activated|reinstated/i
const DAY_TERM = /^(\d+)-day/i

export type InjuredPlayer = {
	person: MLB.Person
	position: MLB.Position
	status: MLB.PlayerStatus
	label: string
	/** Date the player went on the IL, retroactive where the API says so */
	startDate: string | null
	/** Injury text parsed out of the placing transaction */
	reason: string | null
	/** Earliest date the player may be activated; `null` for day-to-day */
	eligibleDate: string | null
	daysOnIL: number | null
}

/**
 * IL type and term for a roster status, or `null` when the player isn't hurt.
 * Allow-list by design: statuses like Active, Reassigned, or Suspended fall
 * through rather than needing to be enumerated.
 */
export function toILTerm(status: MLB.PlayerStatus | undefined): ILTerm | null {
	const mapped = IL_TERMS[status?.code ?? '']
	if (mapped) return mapped

	const description = status?.description ?? ''

	// Unknown code: recover the term from e.g. "10-Day Injured List"
	const [, days] = description.match(DAY_TERM) ?? []
	if (days) return { label: `IL-${days}`, days: Number(days) }

	// Injured, but of a flavor we can't put a term on
	if (IL_STATUS.test(description)) return { label: 'IL', days: null }

	return null
}

/**
 * Pulls the injury out of a status-change description, which reads like
 * "… placed RHP Blake Snell on the 15-day injured list retroactive to
 * April 3, 2025. Left shoulder inflammation."
 */
export function parseInjuryReason(description: string | undefined) {
	if (!description) return null

	const [, afterIL] = description.match(/injured list[^.]*\.\s*(.+?)\.?\s*$/i) ?? []
	if (afterIL) return afterIL

	const [, dayToDay] = description.match(/day-to-day with (.+?)\.?\s*$/i) ?? []
	return dayToDay ?? null
}

/** Retroactive date where the API gives one, otherwise the announcement date. */
function transactionDate(transaction: MLB.Transaction) {
	return transaction.effectiveDate ?? transaction.date
}

/**
 * Joins the full roster against recent transactions to produce the IL rows.
 * The Stats API carries the IL type but no reason and no return date, so the
 * reason is parsed from the placing transaction and the return date is derived
 * as start + term — that is, the earliest date the player becomes eligible.
 */
export function buildInjuredList(
	roster: MLB.Roster[],
	transactions: MLB.Transaction[],
	today: Date | string = getToday(),
): InjuredPlayer[] {
	/** Most recent IL placement per player */
	const placements = new Map<number, MLB.Transaction>()

	for (const transaction of transactions) {
		const id = transaction.person?.id
		if (id == null) continue
		if (!IL_STATUS.test(transaction.description ?? '')) continue
		if (IL_ACTIVATION.test(transaction.description ?? '')) continue

		const current = placements.get(id)
		if (!current || transactionDate(transaction) > transactionDate(current)) {
			placements.set(id, transaction)
		}
	}

	return roster
		.flatMap((entry) => {
			const term = toILTerm(entry.status)
			if (!term) return []

			const person = entry.person as MLB.Person
			const placement = placements.get(person.id)
			const startDate = placement ? transactionDate(placement) : (entry.startDate ?? null)

			return {
				person,
				position: entry.position,
				status: entry.status,
				label: term.label,
				startDate,
				reason: parseInjuryReason(placement?.description),
				eligibleDate: startDate && term.days != null ? addDays(startDate, term.days) : null,
				daysOnIL: startDate ? daysBetween(startDate, today) : null,
			}
		})
		.sort((a, b) => byReturn(a) - byReturn(b) || compareEligible(a, b) || compareName(a, b))
}

/** Day-to-day players return soonest; players with no known date sort last. */
function byReturn(player: InjuredPlayer) {
	if (player.label === 'DTD') return 0
	return player.eligibleDate ? 1 : 2
}

function compareEligible(a: InjuredPlayer, b: InjuredPlayer) {
	if (!a.eligibleDate || !b.eligibleDate) return 0
	return a.eligibleDate.localeCompare(b.eligibleDate)
}

function compareName(a: InjuredPlayer, b: InjuredPlayer) {
	return a.person.lastFirstName?.localeCompare(b.person.lastFirstName ?? '') ?? 0
}
