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

/**
 * Injuries the transaction text says a player isn't coming back from on the
 * minimum term. Ordered most specific first — a Tommy John announcement also
 * says "surgery", and a season-ending one often says both.
 */
const OUTLOOKS: { pattern: RegExp; label: string }[] = [
	{
		pattern: /season[-\s]ending|out for the (?:remainder of the )?season/i,
		label: 'Out for season',
	},
	{ pattern: /tommy john/i, label: 'Tommy John' },
	{ pattern: /surgery|surgical/i, label: 'Surgery' },
]

export type InjuredPlayer = {
	person: MLB.Person
	position: MLB.Position
	status: MLB.PlayerStatus
	label: string
	/** Date the player went on the IL, retroactive where the API says so */
	startDate: string | null
	/** Injury text parsed out of the placing transaction */
	reason: string | null
	/**
	 * Earliest date the player may be activated under his IL term — an
	 * eligibility floor, never a projection of when he'll actually play. The
	 * Stats API publishes no expected return date.
	 */
	eligibleDate: string | null
	/** Days from today to `eligibleDate`; negative once that date has passed */
	daysUntilEligible: number | null
	/** Why the eligibility date is moot, e.g. `Surgery`, when the API says so */
	outlook: string | null
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

/**
 * Short label for an injury the player won't return from on the minimum term,
 * or `null` when the text gives no such signal.
 */
export function parseOutlook(...texts: (string | null | undefined)[]) {
	const haystack = texts.filter(Boolean).join(' ')
	if (!haystack) return null

	return OUTLOOKS.find(({ pattern }) => pattern.test(haystack))?.label ?? null
}

/** Retroactive date where the API gives one, otherwise the announcement date. */
function transactionDate(transaction: MLB.Transaction) {
	return transaction.effectiveDate ?? transaction.date
}

/** The placements making up the player's current, unbroken IL stint. */
function currentStint(transactions: MLB.Transaction[]) {
	const placements: MLB.Transaction[] = []
	let lastActivation: string | null = null

	for (const transaction of transactions) {
		const description = transaction.description ?? ''
		if (!IL_STATUS.test(description)) continue

		const date = transactionDate(transaction)

		if (IL_ACTIVATION.test(description)) {
			if (!lastActivation || date > lastActivation) lastActivation = date
			continue
		}

		placements.push(transaction)
	}

	return placements
		.filter((transaction) => !lastActivation || transactionDate(transaction) > lastActivation)
		.sort((a, b) => transactionDate(a).localeCompare(transactionDate(b)))
}

/**
 * Joins the full roster against recent transactions to produce the IL rows.
 * The Stats API carries the IL type but no reason and no return date, so the
 * reason is parsed from the placing transaction and the date is derived as
 * start + term — the earliest date the player is eligible to be activated,
 * which is a floor rather than a forecast.
 *
 * The stint start is the *earliest* placement since the player's last
 * activation, not the latest: a transfer from the 10-day to the 60-day IL is
 * its own transaction, but the 60 days still run from the original placement.
 *
 * Pass `fortyManIds` to keep the list to big leaguers. Players on the 60-day IL
 * are kept regardless, since being placed on it is what removed them from the
 * 40-man in the first place.
 */
export function buildInjuredList(
	roster: MLB.Roster[],
	transactions: MLB.Transaction[],
	{ fortyManIds, today = getToday() }: { fortyManIds?: Set<number>; today?: Date | string } = {},
): InjuredPlayer[] {
	/** Every transaction that mentions the IL, per player */
	const byPlayer = new Map<number, MLB.Transaction[]>()

	for (const transaction of transactions) {
		const id = transaction.person?.id
		if (id == null) continue
		if (!IL_STATUS.test(transaction.description ?? '')) continue

		byPlayer.set(id, [...(byPlayer.get(id) ?? []), transaction])
	}

	return roster
		.flatMap((entry) => {
			const term = toILTerm(entry.status)
			if (!term) return []

			const person = entry.person as MLB.Person
			if (fortyManIds && !fortyManIds.has(person.id) && term.days !== 60) return []

			const stint = currentStint(byPlayer.get(person.id) ?? [])
			const [placement] = stint
			const latest = stint.at(-1)

			// The roster entry can be reset by a transfer, the transaction window
			// can cut off the original placement — whichever is earlier is the one
			// the term actually counts from.
			const startDate = earliest(placement && transactionDate(placement), entry.startDate)

			const eligibleDate = startDate && term.days != null ? addDays(startDate, term.days) : null

			return {
				person,
				position: entry.position,
				status: entry.status,
				label: term.label,
				startDate,
				// A transfer often restates the injury, but not always; fall back to
				// the placement that opened the stint.
				reason: parseInjuryReason(latest?.description) ?? parseInjuryReason(placement?.description),
				eligibleDate,
				daysUntilEligible: eligibleDate ? daysBetween(today, eligibleDate) : null,
				outlook: parseOutlook(...stint.map(({ description }) => description)),
				daysOnIL: startDate ? daysBetween(startDate, today) : null,
			}
		})
		.sort((a, b) => byReturn(a) - byReturn(b) || compareEligible(a, b) || compareName(a, b))
}

/** The earlier of two dates, ignoring the ones we don't have. */
function earliest(...dates: (string | null | undefined)[]) {
	return dates.filter((date): date is string => !!date).sort()[0] ?? null
}

/**
 * Day-to-day players return soonest, then those with a known eligibility date;
 * players we can't date at all, and those an outlook says are out a while, last.
 */
function byReturn(player: InjuredPlayer) {
	if (player.outlook) return 3
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
