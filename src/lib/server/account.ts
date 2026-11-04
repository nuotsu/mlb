import {
	favoriteHref,
	MAX_FAVORITES,
	mergeAccountState,
	parseFavoriteHref,
	sanitizeSettings,
	sanitizeTimeTravel,
	type AccountSession,
	type AccountState,
	type Settings,
	type TimeTravel,
	type TimeTravelMoment,
} from '#lib/account.js'
import { DELAY_TTL_MS } from '#lib/time-travel.js'
import { describeUserAgent } from '#lib/user-agent.js'
import { and, asc, desc, eq, gt, ne, sql, type SQL } from 'drizzle-orm'
import { getDb } from './db/index.js'
import { session, userFavorites, userPreferences } from './db/schema.js'

/*
	Every function takes the session user's id (from `locals.user`, never from the request body),
	and every query is filtered by it, so a request can only read or write its own rows.
*/

export async function getAccountState(userId: string): Promise<AccountState> {
	const db = getDb()
	const [favorites, [preferences]] = await db.batch([
		db
			.select({
				type: userFavorites.type,
				mlbId: userFavorites.mlbId,
				label: userFavorites.label,
			})
			.from(userFavorites)
			.where(eq(userFavorites.userId, userId))
			.orderBy(asc(userFavorites.createdAt))
			.limit(MAX_FAVORITES),
		db
			.select({ settings: userPreferences.settings, updatedAt: userPreferences.updatedAt })
			.from(userPreferences)
			.where(eq(userPreferences.userId, userId))
			.limit(1),
	])

	return {
		favorites: favorites.map((f) => ({ href: favoriteHref(f), label: f.label })),
		settings: sanitizeSettings(preferences?.settings),
		settingsUpdatedAt: preferences?.updatedAt.getTime() ?? 0,
		timeTravel: sanitizeTimeTravel(
			(preferences?.settings as { timeTravel?: unknown } | undefined)?.timeTravel,
		),
	}
}

/** Merge local (signed-out) data into the account, then return the account */
export async function syncAccountState(userId: string, local: AccountState) {
	const account = await getAccountState(userId)
	const merged = mergeAccountState(account, local)

	const known = new Set(account.favorites.map((f) => f.href))
	const added = merged.favorites.filter((f) => !known.has(f.href))

	const db = getDb()
	const base = Date.now()
	const writes = []

	if (added.length) {
		writes.push(
			db
				.insert(userFavorites)
				.values(
					added.map((f, i) => ({
						userId,
						...parseFavoriteHref(f.href)!,
						label: f.label,
						// Keep local order after the account's existing favorites
						createdAt: new Date(base + i),
					})),
				)
				.onConflictDoNothing(),
		)
	}

	if (merged.settingsUpdatedAt !== account.settingsUpdatedAt) {
		writes.push(upsertSettings(userId, merged.settings, merged.settingsUpdatedAt))
	}

	if (JSON.stringify(merged.timeTravel) !== JSON.stringify(account.timeTravel)) {
		writes.push(replaceTimeTravel(userId, merged.timeTravel))
	}

	if (writes.length) await db.batch(writes as [(typeof writes)[number]])

	return merged
}

export async function addFavorite(userId: string, favorite: App.Favorite) {
	const key = parseFavoriteHref(favorite.href)
	if (!key) return

	const db = getDb()
	const [{ count }] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(userFavorites)
		.where(eq(userFavorites.userId, userId))
	if (count >= MAX_FAVORITES) return

	await db
		.insert(userFavorites)
		.values({ userId, ...key, label: favorite.label })
		.onConflictDoUpdate({
			target: [userFavorites.userId, userFavorites.type, userFavorites.mlbId],
			set: { label: favorite.label },
		})
}

export async function removeFavorite(userId: string, href: string) {
	const key = parseFavoriteHref(href)
	if (!key) return

	await getDb()
		.delete(userFavorites)
		.where(
			and(
				eq(userFavorites.userId, userId),
				eq(userFavorites.type, key.type),
				eq(userFavorites.mlbId, key.mlbId),
			),
		)
}

/** Save settings unless the account already has newer ones. Returns what's stored. */
export async function saveSettings(userId: string, settings: Settings, updatedAt: number) {
	await upsertSettings(userId, settings, updatedAt)
	return getAccountState(userId)
}

/*
	Time-travel moments live in the same JSON column, under `timeTravel`, but are written on
	their own: settings writes keep the stored moments, and moment writes leave `updated_at`
	(the settings' "newest wins" stamp) alone. A row created by a moment gets `updated_at` = 0,
	so the account still counts as never having saved settings.
*/

const storedTimeTravel = sql`coalesce(${userPreferences.settings} -> 'timeTravel', '{}'::jsonb)`

function upsertSettings(userId: string, settings: Settings, updatedAt: number) {
	// Clamp client clocks: never in the future
	const at = new Date(Math.min(updatedAt || Date.now(), Date.now()))

	return getDb()
		.insert(userPreferences)
		.values({ userId, settings, updatedAt: at })
		.onConflictDoUpdate({
			target: userPreferences.userId,
			set: {
				settings: sql`excluded.settings || jsonb_build_object('timeTravel', ${storedTimeTravel})`,
				updatedAt: at,
			},
			// Newest wins
			setWhere: sql`${userPreferences.updatedAt} < ${at}`,
		})
}

/** Write the stored moments with `next` (SQL over the current ones), dropping expired ones */
function writeTimeTravel(userId: string, initial: TimeTravel, next: SQL) {
	const cutoff = Date.now() - DELAY_TTL_MS
	return getDb()
		.insert(userPreferences)
		.values({ userId, settings: { timeTravel: initial } as Settings, updatedAt: new Date(0) })
		.onConflictDoUpdate({
			target: userPreferences.userId,
			set: {
				settings: sql`${userPreferences.settings} || jsonb_build_object('timeTravel', (
					select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
					from jsonb_each(${next})
					where (value ->> 'savedAt')::bigint > ${cutoff}
				))`,
			},
		})
}

function replaceTimeTravel(userId: string, timeTravel: TimeTravel) {
	return writeTimeTravel(userId, timeTravel, sql`${JSON.stringify(timeTravel)}::jsonb`)
}

/** Save one game's moment, unless the account already has a newer one */
export async function saveMoment(userId: string, gamePk: string, moment: TimeTravelMoment) {
	const value = JSON.stringify(moment)
	const storedSavedAt = sql`coalesce((${storedTimeTravel} -> ${gamePk}::text ->> 'savedAt')::bigint, 0)`
	await writeTimeTravel(
		userId,
		{ [gamePk]: moment },
		sql`case when ${storedSavedAt} < ${moment.savedAt}
			then ${storedTimeTravel} || jsonb_build_object(${gamePk}::text, ${value}::jsonb)
			else ${storedTimeTravel} end`,
	)
}

/** Forget one game's moment (it went live) */
export async function forgetMoment(userId: string, gamePk: string) {
	await writeTimeTravel(userId, {}, sql`${storedTimeTravel} - ${gamePk}::text`)
}

/** The user's active sessions, current one first */
export async function listSessions(userId: string, currentId: string): Promise<AccountSession[]> {
	const rows = await getDb()
		.select({
			id: session.id,
			userAgent: session.userAgent,
			updatedAt: session.updatedAt,
		})
		.from(session)
		.where(and(eq(session.userId, userId), gt(session.expiresAt, new Date())))
		.orderBy(desc(session.updatedAt))
		.limit(20)

	return rows
		.map((row) => ({
			id: row.id,
			...describeUserAgent(row.userAgent),
			lastActive: row.updatedAt.toISOString(),
			current: row.id === currentId,
		}))
		.sort((a, b) => Number(b.current) - Number(a.current))
}

/** Sign out every other device. Their cached session cookies lapse within 5 minutes. */
export async function revokeOtherSessions(userId: string, currentId: string) {
	await getDb()
		.delete(session)
		.where(and(eq(session.userId, userId), ne(session.id, currentId)))
}
