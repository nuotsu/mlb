import type { HomeWidgetId, SeasonPhase } from '#lib/home.js'
import {
	ArrowsDiffIcon,
	CalendarIcon,
	CalendarTodayIcon,
	HelmetIcon,
	JerseyIcon,
	MegaphoneIcon,
	RankIcon,
	SplitIcon,
} from '#ui/icons/index.js'
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

/** `icon` is the widget's button in the section nav, matching the sidebar's where there is one */
export const WIDGETS: Record<
	HomeWidgetId,
	{
		label: string
		icon: Component<Record<string, unknown>>
		component: Component<{ data: WidgetData }>
	}
> = {
	today: { label: "Today's games", icon: CalendarTodayIcon, component: Today },
	team: { label: 'Team schedule', icon: JerseyIcon, component: Team },
	transactions: { label: 'Transactions', icon: ArrowsDiffIcon, component: Transactions },
	blog: { label: 'Blog', icon: MegaphoneIcon, component: Blog },
	standings: { label: 'Standings', icon: RankIcon, component: Standings },
	players: { label: 'Your players', icon: HelmetIcon, component: Players },
	compare: { label: 'Compare', icon: SplitIcon, component: Compare },
	season: { label: 'Season schedule', icon: CalendarIcon, component: Season },
}
