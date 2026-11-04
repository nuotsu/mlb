import { relations, sql } from 'drizzle-orm'
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from 'drizzle-orm/pg-core'
import type { Settings } from '../../account.js'

/*
	Better Auth core tables (user, session, account, verification), matching
	`@better-auth/cli generate` for the Drizzle adapter with provider "pg".
*/

export const user = pgTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').default(false).notNull(),
	image: text('image'),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
})

export const session = pgTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: timestamp('expires_at').notNull(),
		token: text('token').notNull().unique(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.$onUpdate(() => new Date())
			.notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
	},
	(table) => [index('session_userId_idx').on(table.userId)],
)

export const account = pgTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at'),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
		scope: text('scope'),
		password: text('password'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index('account_userId_idx').on(table.userId)],
)

export const verification = pgTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index('verification_identifier_idx').on(table.identifier)],
)

/*
	App data, modeled on localStorage:
	- `favorites`: `{ href, label }[]` where href is `/teams/:id`, `/player/:id`, or `/game/:gamePk`
	- `color-scheme`, `spoiler-prevention`, `onboarding-dismissed`: folded into `settings`
*/

export const userPreferences = pgTable('user_preferences', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	settings: jsonb('settings').$type<Settings>().default({}).notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const favoriteType = pgEnum('favorite_type', ['team', 'player', 'game'])

export const userFavorites = pgTable(
	'user_favorites',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		type: favoriteType('type').notNull(),
		mlbId: integer('mlb_id').notNull(),
		/** Display label shown in the sidebar (team abbreviation, player last name, "NYY @ BOS") */
		label: text('label').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.type, table.mlbId] }),
		check('user_favorites_mlb_id_positive', sql`${table.mlbId} > 0`),
	],
)

export const userRelations = relations(user, ({ many, one }) => ({
	sessions: many(session),
	accounts: many(account),
	favorites: many(userFavorites),
	preferences: one(userPreferences),
}))

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
	user: one(user, { fields: [userPreferences.userId], references: [user.id] }),
}))

export const userFavoritesRelations = relations(userFavorites, ({ one }) => ({
	user: one(user, { fields: [userFavorites.userId], references: [user.id] }),
}))
