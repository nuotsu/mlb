import type { HomeWidgetId, SeasonPhase } from '#lib/home.js'
import type { Component } from 'svelte'
import Blog from './blog.svelte'
import Compare from './compare.svelte'
import Players from './players.svelte'
import Season from './season.svelte'
import Standings from './standings.svelte'
import Team from './team.svelte'
import Today from './today.svelte'
import Transactions from './transactions.svelte'

/** The home page's data, handed to every widget */
export type WidgetData = {
	/** This season, or next season's once this one is over */
	season: MLB.SeasonDateInfo | null
	phase: SeasonPhase
	/** Last season's until this one's regular season starts */
	standingsSeason: string
	transactions: MLB.Transaction[]
	posts: Blog.Post[]
}

export const WIDGETS: Record<
	HomeWidgetId,
	{ label: string; component: Component<{ data: WidgetData }> }
> = {
	today: { label: "Today's games", component: Today },
	team: { label: 'Team schedule', component: Team },
	transactions: { label: 'Transactions', component: Transactions },
	blog: { label: 'Blog', component: Blog },
	standings: { label: 'Standings', component: Standings },
	players: { label: 'Your players', component: Players },
	compare: { label: 'Compare', component: Compare },
	season: { label: 'Season schedule', component: Season },
}
