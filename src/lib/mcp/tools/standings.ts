import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { fetchMLB } from '../fetch.js'

function currentSeason() {
	const d = new Date()
	return d.getMonth() <= 1 ? d.getFullYear() - 1 : d.getFullYear()
}

export function registerStandingsTools(server: McpServer) {
	server.tool(
		'get_standings',
		'Get current MLB standings by division or league.',
		{
			league: z
				.enum(['AL', 'NL', 'both'])
				.optional()
				.describe('Filter by league. Defaults to both leagues.'),
			division: z
				.enum(['AL East', 'AL Central', 'AL West', 'NL East', 'NL Central', 'NL West'])
				.optional()
				.describe('Filter to a specific division.'),
			season: z
				.number()
				.optional()
				.describe('Season year. Defaults to current season.'),
		},
		async ({ league, division, season }) => {
			const leagueId =
				league === 'AL' ? '103' : league === 'NL' ? '104' : '103,104'

			const data = await fetchMLB<MLB.StandingsResponse>('/api/v1/standings', {
				leagueId,
				standingsType: 'regularSeason',
				season: (season ?? currentSeason()).toString(),
				fields: [
					'records,standingsType,division,id,name',
					'teamRecords,team,id,name,abbreviation',
					'leagueRecord,wins,losses,pct',
					'gamesBack,wildCardGamesBack,magicNumber,eliminationNumber',
					'streak,streakType,streakNumber,streakCode',
					'lastTen,wins,losses',
					'divisionChamp,divisionLeader,wildCardLeader,clinched',
				],
			})

			const records = data?.records ?? []
			if (!records.length) return { content: [{ type: 'text', text: 'No standings data found.' }] }

			const lines: string[] = []
			for (const record of records) {
				const divName = record.division?.name ?? 'Unknown Division'
				if (division && divName !== division) continue

				lines.push(`\n### ${divName}`)
				lines.push('| # | Team | W | L | PCT | GB | Streak | L10 |')
				lines.push('|---|------|---|---|-----|----|--------|-----|')

				const teams = record.teamRecords ?? []
				teams.forEach((tr, i) => {
					const team = tr.team?.name ?? '?'
					const lr = tr.leagueRecord
					const streak = tr.streak?.streakCode ?? '-'
					const gb = tr.gamesBack === '0' ? '-' : tr.gamesBack ?? '-'
					const lastTen = tr.records?.splitRecords?.find((s: { type: string }) => s.type === 'lastTen')
					const l10 = lastTen ? `${lastTen.wins}-${lastTen.losses}` : '-'
					const clinched = tr.clinched ? ' ✓' : ''
					lines.push(`| ${i + 1} | ${team}${clinched} | ${lr?.wins ?? 0} | ${lr?.losses ?? 0} | ${lr?.pct ?? '.000'} | ${gb} | ${streak} | ${l10} |`)
				})
			}

			return { content: [{ type: 'text', text: lines.join('\n') }] }
		},
	)
}
