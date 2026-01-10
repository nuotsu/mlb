/**
 * MLB Stats API TypeScript Definitions
 *
 * Comprehensive type definitions for the MLB Stats API endpoints.
 * These types are generated from real API responses and cover all known fields.
 *
 * @see https://statsapi.mlb.com
 */

// Common Utility Types

declare global {
	namespace MLB {
		/**
		 * Generic API response wrapper
		 */
		interface ApiResponse<T> {
			copyright: string
			[key: string]: T | string | number | boolean | null | undefined
		}

		/**
		 * Link reference to related API resources
		 */
		interface ApiLink {
			href: string
		}

		// Team Types

		/**
		 * Basic team information
		 */
		interface Team {
			id: number
			name: string
			link: string
			teamCode?: string
			fileCode?: string
			abbreviation?: string
			teamName?: string
			locationName?: string
			firstYearOfPlay?: string
			shortName?: string
			franchiseName?: string
			clubName?: string
			active?: boolean
		}

		/**
		 * Team with venue information
		 */
		interface TeamDetailed extends Team {
			season?: number
			venue?: Venue
			springVenue?: Venue
			league?: League
			division?: Division
			sport?: Sport
			springLeague?: SpringLeague
		}

		/**
		 * Team league record
		 */
		interface LeagueRecord {
			wins: number
			losses: number
			pct?: string
			ties?: number
		}

		/**
		 * Team in a game context
		 */
		interface GameTeam {
			leagueRecord: LeagueRecord
			score?: number
			team: Team
			isWinner?: boolean
			splitSquad?: boolean
			seriesNumber?: number
		}

		// Player/Person Types

		/**
		 * Basic person information
		 */
		interface Person {
			id: number
			fullName: string
			link: string
			firstName?: string
			lastName?: string
			primaryNumber?: string
			birthDate?: string
			currentAge?: number
			birthCity?: string
			birthStateProvince?: string
			birthCountry?: string
			height?: string
			weight?: number
			active?: boolean
			primaryPosition?: Position
			useName?: string
			middleName?: string
			boxscoreName?: string
			nickName?: string
			gender?: string
			isPlayer?: boolean
			isVerified?: boolean
			draftYear?: number
			mlbDebutDate?: string
			batSide?: BatSide
			pitchHand?: PitchHand
			nameFirstLast?: string
			nameSlug?: string
			firstLastName?: string
			lastFirstName?: string
			lastInitName?: string
			initLastName?: string
			fullFMLName?: string
			fullLFMName?: string
			strikeZoneTop?: number
			strikeZoneBottom?: number
		}

		/**
		 * Player position
		 */
		interface Position {
			code: string
			name: string
			type: string
			abbreviation: string
		}

		/**
		 * Batting side information
		 */
		interface BatSide {
			code: string
			description: string
		}

		/**
		 * Pitching hand information
		 */
		interface PitchHand {
			code: string
			description: string
		}

		/**
		 * Player stats summary
		 */
		interface PlayerStats {
			type: StatType
			group?: string
			exemptions?: unknown[]
			splits: StatSplit[]
		}

		/**
		 * Individual stat split
		 */
		interface StatSplit {
			season?: string
			stat: Record<string, number | string>
			team?: Team
			player?: Person
			league?: League
			sport?: Sport
			gameType?: string
			numTeams?: number
			rank?: number
		}

		/**
		 * Stat type descriptor
		 */
		interface StatType {
			displayName: string
		}

		// Game Types

		/**
		 * Game status information
		 */
		interface GameStatus {
			abstractGameState: 'Preview' | 'Live' | 'Final'
			codedGameState: string
			detailedState: string
			statusCode: string
			startTimeTBD?: boolean
			abstractGameCode: string
			reason?: string
		}

		/**
		 * Basic game information
		 */
		interface Game {
			gamePk: number
			link: string
			gameType: string
			season: string
			gameDate: string
			officialDate: string
			status: GameStatus
			teams: {
				away: GameTeam
				home: GameTeam
			}
			venue: Venue
			content?: {
				link: string
			}
			gameNumber?: number
			publicFacing?: boolean
			doubleHeader?: string
			gamedayType?: string
			tiebreaker?: string
			calendarEventID?: string
			seasonDisplay?: string
			dayNight?: string
			description?: string
			scheduledInnings?: number
			reverseHomeAwayStatus?: boolean
			inningBreakLength?: number
			gamesInSeries?: number
			seriesGameNumber?: number
			seriesDescription?: string
			recordSource?: string
			ifNecessary?: string
			ifNecessaryDescription?: string
		}

		/**
		 * Live game feed data
		 */
		interface LiveGameFeed {
			copyright: string
			gamePk: number
			link: string
			metaData: GameMetaData
			gameData: GameData
			liveData: LiveData
		}

		/**
		 * Game metadata
		 */
		interface GameMetaData {
			wait: number
			timeStamp: string
			gameEvents: string[]
			logicalEvents: string[]
		}

		/**
		 * Static game data
		 */
		interface GameData {
			game: Game
			datetime: GameDateTime
			status: GameStatus
			teams: {
				away: TeamDetailed
				home: TeamDetailed
			}
			players: Record<string, PlayerGameData>
			venue: Venue
			officialVenue?: Venue
			weather?: Weather
			gameInfo?: GameInfo
			review?: Review
			flags?: GameFlags
			alerts?: unknown[]
			probablePitchers?: {
				away?: Person
				home?: Person
			}
			officialScorer?: Person
			primaryDatacaster?: Person
		}

		/**
		 * Game date/time information
		 */
		interface GameDateTime {
			dateTime: string
			originalDate?: string
			officialDate: string
			dayNight: string
			time: string
			ampm: string
		}

		/**
		 * Player in game context
		 */
		interface PlayerGameData {
			person: Person
			jerseyNumber?: string
			position?: Position
			status?: PlayerStatus
			parentTeamId?: number
			battingOrder?: string
			stats?: Record<string, unknown>
			seasonStats?: Record<string, unknown>
			gameStatus?: PlayerGameStatus
		}

		/**
		 * Player status
		 */
		interface PlayerStatus {
			code: string
			description: string
		}

		/**
		 * Player game status
		 */
		interface PlayerGameStatus {
			isCurrentBatter?: boolean
			isCurrentPitcher?: boolean
			isOnBench?: boolean
			isSubstitute?: boolean
		}

		/**
		 * Live game data
		 */
		interface LiveData {
			plays: Plays
			linescore: Linescore
			boxscore: Boxscore
			decisions?: Decisions
			leaders?: Leaders
		}

		/**
		 * Game plays data
		 */
		interface Plays {
			allPlays: Play[]
			currentPlay?: Play
			scoringPlays: number[]
			playsByInning: PlaysByInning[]
		}

		/**
		 * Individual play
		 */
		interface Play {
			result: PlayResult
			about: PlayAbout
			count: Count
			matchup: Matchup
			pitchIndex?: number[]
			actionIndex?: number[]
			runnerIndex?: number[]
			runners?: Runner[]
			playEvents?: PlayEvent[]
			playEndTime?: string
			atBatIndex?: number
		}

		/**
		 * Play result
		 */
		interface PlayResult {
			type: string
			event: string
			eventType: string
			description: string
			rbi?: number
			awayScore?: number
			homeScore?: number
		}

		/**
		 * Play about information
		 */
		interface PlayAbout {
			atBatIndex: number
			halfInning: 'top' | 'bottom'
			isTopInning: boolean
			inning: number
			startTime?: string
			endTime?: string
			isComplete?: boolean
			isScoringPlay?: boolean
			hasReview?: boolean
			hasOut?: boolean
			captivatingIndex?: number
		}

		/**
		 * Pitch count
		 */
		interface Count {
			balls: number
			strikes: number
			outs: number
		}

		/**
		 * Batter/pitcher matchup
		 */
		interface Matchup {
			batter: Person
			batSide: BatSide
			pitcher: Person
			pitchHand: PitchHand
			batterHotColdZones?: unknown[]
			pitcherHotColdZones?: unknown[]
			splits?: MatchupSplits
			postOnFirst?: Person
			postOnSecond?: Person
			postOnThird?: Person
		}

		/**
		 * Matchup splits data
		 */
		interface MatchupSplits {
			batter: string
			pitcher: string
			menOnBase: string
		}

		/**
		 * Base runner information
		 */
		interface Runner {
			movement: RunnerMovement
			details: RunnerDetails
			credits?: RunnerCredit[]
		}

		/**
		 * Runner movement
		 */
		interface RunnerMovement {
			originBase?: string | null
			start?: string | null
			end?: string | null
			outBase?: string | null
			isOut?: boolean
			outNumber?: number
		}

		/**
		 * Runner details
		 */
		interface RunnerDetails {
			event: string
			eventType: string
			movementReason?: string | null
			runner: Person
			responsiblePitcher?: Person | null
			isScoringEvent?: boolean
			rbi?: boolean
			earned?: boolean
			teamUnearned?: boolean
			playIndex?: number
		}

		/**
		 * Runner credit
		 */
		interface RunnerCredit {
			player: Person
			position: Position
			credit: string
		}

		/**
		 * Play event (pitch or action)
		 */
		interface PlayEvent {
			details?: PitchDetails
			count?: Count
			pitchData?: PitchData
			index?: number
			startTime?: string
			endTime?: string
			isPitch?: boolean
			type?: string
		}

		/**
		 * Pitch details
		 */
		interface PitchDetails {
			call: PitchCall
			description: string
			code: string
			ballColor: string
			trailColor: string
			isInPlay?: boolean
			isStrike?: boolean
			isBall?: boolean
			type: PitchType
			hasReview?: boolean
		}

		/**
		 * Pitch call
		 */
		interface PitchCall {
			code: string
			description: string
		}

		/**
		 * Pitch type
		 */
		interface PitchType {
			code: string
			description: string
		}

		/**
		 * Pitch data (Statcast)
		 */
		interface PitchData {
			startSpeed?: number
			endSpeed?: number
			strikeZoneTop?: number
			strikeZoneBottom?: number
			coordinates?: PitchCoordinates
			breaks?: PitchBreaks
			zone?: number
			typeConfidence?: number
			plateTime?: number
			extension?: number
		}

		/**
		 * Pitch coordinates
		 */
		interface PitchCoordinates {
			aY?: number
			aZ?: number
			pfxX?: number
			pfxZ?: number
			pX?: number
			pZ?: number
			vX0?: number
			vY0?: number
			vZ0?: number
			x?: number
			y?: number
			x0?: number
			y0?: number
			z0?: number
			aX?: number
		}

		/**
		 * Pitch breaks
		 */
		interface PitchBreaks {
			breakAngle?: number
			breakLength?: number
			breakY?: number
			breakVertical?: number
			breakVerticalInduced?: number
			breakHorizontal?: number
			spinRate?: number
			spinDirection?: number
		}

		/**
		 * Plays by inning
		 */
		interface PlaysByInning {
			startIndex: number
			endIndex: number
			top: number[]
			bottom: number[]
			hits: {
				away: Hit[]
				home: Hit[]
			}
		}

		/**
		 * Hit information
		 */
		interface Hit {
			team: Team
			inning: number
			pitcher: Person
			batter: Person
			coordinates: HitCoordinates
			type: string
			description: string
		}

		/**
		 * Hit coordinates
		 */
		interface HitCoordinates {
			coordX: number
			coordY: number
		}

		/**
		 * Game linescore
		 */
		interface Linescore {
			currentInning?: number
			currentInningOrdinal?: string
			inningState?: string
			inningHalf?: string
			isTopInning?: boolean
			scheduledInnings?: number
			innings?: InningScore[]
			teams?: {
				home: LinescoreTeam
				away: LinescoreTeam
			}
			defense?: Defense
			offense?: Offense
			balls?: number
			strikes?: number
			outs?: number
		}

		/**
		 * Inning score
		 */
		interface InningScore {
			num: number
			ordinalNum: string
			home?: InningHalfScore
			away?: InningHalfScore
		}

		/**
		 * Half-inning score
		 */
		interface InningHalfScore {
			runs?: number
			hits?: number
			errors?: number
			leftOnBase?: number
		}

		/**
		 * Team linescore
		 */
		interface LinescoreTeam {
			runs?: number
			hits?: number
			errors?: number
			leftOnBase?: number
		}

		/**
		 * Defensive positions
		 */
		interface Defense {
			pitcher?: Person
			catcher?: Person
			first?: Person
			second?: Person
			third?: Person
			shortstop?: Person
			left?: Person
			center?: Person
			right?: Person
			batter?: Person
			onDeck?: Person
			inHole?: Person
			battingOrder?: number
			team?: Team
		}

		/**
		 * Offensive positions
		 */
		interface Offense {
			batter?: Person
			onDeck?: Person
			inHole?: Person
			pitcher?: Person
			battingOrder?: number
			team?: Team
			first?: Person
			second?: Person
			third?: Person
		}

		/**
		 * Game boxscore
		 */
		interface Boxscore {
			teams: {
				away: TeamBoxscore
				home: TeamBoxscore
			}
			officials?: Official[]
			info?: BoxscoreInfo[]
			pitchingNotes?: string[]
		}

		/**
		 * Team boxscore
		 */
		interface TeamBoxscore {
			team: Team
			teamStats: TeamStats
			players: Record<string, BoxscorePlayer>
			batters: number[]
			pitchers: number[]
			bench: number[]
			bullpen: number[]
			battingOrder: number[]
			info?: BoxscoreInfo[]
			note?: BoxscoreNote[]
		}

		/**
		 * Team stats
		 */
		interface TeamStats {
			batting: BattingStats
			pitching: PitchingStats
			fielding: FieldingStats
		}

		/**
		 * Batting statistics
		 */
		interface BattingStats {
			runs?: number
			doubles?: number
			triples?: number
			homeRuns?: number
			strikeOuts?: number
			baseOnBalls?: number
			intentionalWalks?: number
			hits?: number
			hitByPitch?: number
			avg?: string
			atBats?: number
			obp?: string
			slg?: string
			ops?: string
			caughtStealing?: number
			stolenBases?: number
			stolenBasePercentage?: string
			groundIntoDoublePlay?: number
			numberOfPitches?: number
			plateAppearances?: number
			totalBases?: number
			rbi?: number
			leftOnBase?: number
			sacBunts?: number
			sacFlies?: number
			babip?: string
			groundOutsToAirouts?: string
			catchersInterference?: number
			atBatsPerHomeRun?: string
		}

		/**
		 * Pitching statistics
		 */
		interface PitchingStats {
			runs?: number
			doubles?: number
			triples?: number
			homeRuns?: number
			strikeOuts?: number
			baseOnBalls?: number
			intentionalWalks?: number
			hits?: number
			hitByPitch?: number
			atBats?: number
			obp?: string
			caughtStealing?: number
			stolenBases?: number
			stolenBasePercentage?: string
			numberOfPitches?: number
			era?: string
			inningsPitched?: string
			wins?: number
			losses?: number
			saves?: number
			saveOpportunities?: number
			holds?: number
			blownSaves?: number
			earnedRuns?: number
			whip?: string
			battersFaced?: number
			outs?: number
			gamesPitched?: number
			completeGames?: number
			shutouts?: number
			strikes?: number
			strikePercentage?: string
			hitBatsmen?: number
			balks?: number
			wildPitches?: number
			pickoffs?: number
			totalBases?: number
			groundOutsToAirouts?: string
			winPercentage?: string
			pitchesPerInning?: string
			gamesFinished?: number
			strikeoutWalkRatio?: string
			strikeoutsPer9Inn?: string
			walksPer9Inn?: string
			hitsPer9Inn?: string
			runsScoredPer9?: string
			homeRunsPer9?: string
			inheritedRunners?: number
			inheritedRunnersScored?: number
			catchersInterference?: number
			sacBunts?: number
			sacFlies?: number
		}

		/**
		 * Fielding statistics
		 */
		interface FieldingStats {
			caughtStealing?: number
			stolenBases?: number
			stolenBasePercentage?: string
			assists?: number
			putOuts?: number
			errors?: number
			chances?: number
			fielding?: string
			passedBall?: number
		}

		/**
		 * Boxscore player
		 */
		interface BoxscorePlayer {
			person: Person
			jerseyNumber?: string
			position: Position
			status: PlayerStatus
			parentTeamId: number
			stats?: {
				batting?: BattingStats
				pitching?: PitchingStats
				fielding?: FieldingStats
			}
			seasonStats?: {
				batting?: BattingStats
				pitching?: PitchingStats
				fielding?: FieldingStats
			}
			gameStatus?: PlayerGameStatus
			allPositions?: Position[]
		}

		/**
		 * Game official (umpire)
		 */
		interface Official {
			official: Person
			officialType: string
		}

		/**
		 * Boxscore info line
		 */
		interface BoxscoreInfo {
			label: string
			value: string
		}

		/**
		 * Boxscore note
		 */
		interface BoxscoreNote {
			label: string
			value: string
		}

		/**
		 * Game decisions (winning/losing pitcher, save)
		 */
		interface Decisions {
			winner?: Person
			loser?: Person
			save?: Person
		}

		/**
		 * Game leaders
		 */
		interface Leaders {
			hitDistance?: Leader
			hitSpeed?: Leader
			pitchSpeed?: Leader
		}

		/**
		 * Leader information
		 */
		interface Leader {
			leaders: LeaderEntry[]
		}

		/**
		 * Leader entry
		 */
		interface LeaderEntry {
			person: Person
			value: number
			team?: Team
		}

		/**
		 * Weather information
		 */
		interface Weather {
			condition: string
			temp: string
			wind: string
		}

		/**
		 * Game info
		 */
		interface GameInfo {
			attendance?: number
			firstPitch?: string
			gameDurationMinutes?: number
		}

		/**
		 * Review information
		 */
		interface Review {
			hasChallenges: boolean
			away: ReviewTeam
			home: ReviewTeam
		}

		/**
		 * Team review info
		 */
		interface ReviewTeam {
			used: number
			remaining: number
		}

		/**
		 * Game flags
		 */
		interface GameFlags {
			noHitter?: boolean
			perfectGame?: boolean
			awayTeamNoHitter?: boolean
			awayTeamPerfectGame?: boolean
			homeTeamNoHitter?: boolean
			homeTeamPerfectGame?: boolean
		}

		// Schedule Types

		/**
		 * Schedule response
		 */
		interface ScheduleResponse extends ApiResponse<ScheduleDate[]> {
			totalItems: number
			totalEvents: number
			totalGames: number
			totalGamesInProgress: number
			dates: ScheduleDate[]
		}

		/**
		 * Schedule date
		 */
		interface ScheduleDate {
			date: string
			totalItems: number
			totalEvents: number
			totalGames: number
			totalGamesInProgress: number
			games: Game[]
			events: ScheduleEvent[]
		}

		/**
		 * Schedule event
		 */
		interface ScheduleEvent {
			id: string
			name: string
			link: string
		}

		// Standings Types

		/**
		 * Standings response
		 */
		interface StandingsResponse extends ApiResponse<StandingsRecord[]> {
			records: StandingsRecord[]
		}

		/**
		 * Standings record
		 */
		interface StandingsRecord {
			standingsType: string
			league: League
			division: Division
			sport: Sport
			lastUpdated: string
			teamRecords: TeamRecord[]
		}

		/**
		 * Team record
		 */
		interface TeamRecord {
			team: Team
			season: string
			streak: Streak
			divisionRank: string
			leagueRank: string
			wildCardRank?: string
			sportRank: string
			gamesPlayed: number
			gamesBack: string
			wildCardGamesBack?: string
			leagueGamesBack?: string
			springLeagueGamesBack?: string
			sportGamesBack?: string
			divisionGamesBack?: string
			conferenceGamesBack?: string
			leagueRecord: LeagueRecord
			records: Records
			divisionLeader?: boolean
			wins: number
			losses: number
			runDifferential: number
			winningPercentage: string
		}

		/**
		 * Team streak
		 */
		interface Streak {
			streakType: string
			streakNumber: number
			streakCode: string
		}

		/**
		 * Various team records
		 */
		interface Records {
			splitRecords: SplitRecord[]
			divisionRecords?: SplitRecord[]
			overallRecords?: SplitRecord[]
			leagueRecords?: SplitRecord[]
			expectedRecords?: SplitRecord[]
		}

		/**
		 * Split record
		 */
		interface SplitRecord {
			wins: number
			losses: number
			type: string
			pct?: string
		}

		// Stats Leaders Types

		/**
		 * Stats leaders response
		 */
		interface StatsLeadersResponse extends ApiResponse<LeaderCategory[]> {
			leagueLeaders: LeaderCategory[]
		}

		/**
		 * Leader category
		 */
		interface LeaderCategory {
			leaderCategory: string
			season: string
			statGroup: string
			totalSplits: number
			leaders: StatLeader[]
		}

		/**
		 * Stat leader
		 */
		interface StatLeader {
			rank: number
			value: string
			team: Team
			league: League
			person: Person
			numTeams?: number
		}

		// Venue Types

		/**
		 * Venue information
		 */
		interface Venue {
			id: number
			name: string
			link: string
			location?: VenueLocation
			timeZone?: TimeZone
			fieldInfo?: FieldInfo
			active?: boolean
			season?: string
		}

		/**
		 * Venue location
		 */
		interface VenueLocation {
			address1?: string
			city?: string
			state?: string
			stateAbbrev?: string
			postalCode?: string
			defaultCoordinates?: Coordinates
			country?: string
			phone?: string
		}

		/**
		 * Geographic coordinates
		 */
		interface Coordinates {
			latitude: number
			longitude: number
		}

		/**
		 * Time zone
		 */
		interface TimeZone {
			id: string
			offset: number
			tz: string
		}

		/**
		 * Field information
		 */
		interface FieldInfo {
			capacity?: number
			turfType?: string
			roofType?: string
			leftLine?: number
			leftCenter?: number
			center?: number
			rightCenter?: number
			rightLine?: number
		}

		// League/Division/Sport Types

		/**
		 * League information
		 */
		interface League {
			id: number
			name: string
			link: string
			abbreviation?: string
			nameShort?: string
			seasonState?: string
			hasWildCard?: boolean
			hasSplitSeason?: boolean
			numGames?: number
			hasPlayoffPoints?: boolean
			numTeams?: number
			numWildcardTeams?: number
			seasonDateInfo?: SeasonDateInfo
			season?: string
			orgCode?: string
			conferencesInUse?: boolean
			divisionsInUse?: boolean
			sport?: Sport
		}

		/**
		 * Division information
		 */
		interface Division {
			id: number
			name: string
			link: string
			season?: string
			nameShort?: string
			abbreviation?: string
			league?: League
			sport?: Sport
			hasWildcard?: boolean
			sortOrder?: number
			numPlayoffTeams?: number
			active?: boolean
		}

		/**
		 * Sport information
		 */
		interface Sport {
			id: number
			link: string
			name: string
			code?: string
			abbreviation?: string
			sortOrder?: number
			activeStatus?: boolean
		}

		/**
		 * Spring league
		 */
		interface SpringLeague {
			id: number
			name: string
			link: string
			abbreviation?: string
		}

		/**
		 * Season date information
		 */
		interface SeasonDateInfo {
			seasonId: string
			preSeasonStartDate?: string
			preSeasonEndDate?: string
			seasonStartDate?: string
			springStartDate?: string
			springEndDate?: string
			regularSeasonStartDate?: string
			lastDate1stHalf?: string
			allStarDate?: string
			firstDate2ndHalf?: string
			regularSeasonEndDate?: string
			postSeasonStartDate?: string
			postSeasonEndDate?: string
			seasonEndDate?: string
			offseasonStartDate?: string
			offSeasonEndDate?: string
			seasonLevelGamedayType?: string
			gameLevelGamedayType?: string
			qualifierPlateAppearances?: number
			qualifierOutsPitched?: number
		}

		// Draft Types

		/**
		 * Draft response
		 */
		interface DraftResponse extends ApiResponse<Draft> {
			drafts: Draft[]
		}

		/**
		 * Draft information
		 */
		interface Draft {
			draftYear: number
			rounds: DraftRound[]
		}

		/**
		 * Draft round
		 */
		interface DraftRound {
			roundNumber: number
			round: string
			picks: DraftPick[]
		}

		/**
		 * Draft pick
		 */
		interface DraftPick {
			bisPlayerId?: number
			pickRound: string
			pickNumber: number
			roundPickNumber: number
			rank?: number
			pickValue?: string
			signingBonus?: string
			scouttingReport?: string
			blurb?: string
			headshotLink?: string
			year: string
			home?: DraftPickLocation
			school?: DraftSchool
			person?: Person
			team?: Team
			isDrafted?: boolean
			isPass?: boolean
		}

		/**
		 * Draft pick location
		 */
		interface DraftPickLocation {
			city?: string
			state?: string
			country?: string
		}

		/**
		 * Draft school
		 */
		interface DraftSchool {
			name: string
			schoolClass?: string
			country?: string
			state?: string
			city?: string
		}

		// Transaction Types

		/**
		 * Transactions response
		 */
		interface TransactionsResponse extends ApiResponse<Transaction[]> {
			transactions: Transaction[]
		}

		/**
		 * Transaction
		 */
		interface Transaction {
			person: Person
			date: string
			effectiveDate?: string
			resolutionDate?: string
			timeStamp: string
			typeCode: string
			typeDesc: string
			description: string
			fromTeam?: Team
			toTeam?: Team
		}

		// Awards Types

		/**
		 * Awards response
		 */
		interface AwardsResponse extends ApiResponse<Award[]> {
			awards: Award[]
		}

		/**
		 * Award
		 */
		interface Award {
			id: string
			name: string
			date?: string
			season?: string
			votes?: number
			notes?: string
			team?: Team
			player?: Person
			position?: Position
		}

		// Attendance Types

		/**
		 * Attendance response
		 */
		interface AttendanceResponse extends ApiResponse<AttendanceRecord[]> {
			records: AttendanceRecord[]
		}

		/**
		 * Attendance record
		 */
		interface AttendanceRecord {
			team: Team
			season: string
			totalAttendance: number
			homeAttendance: number
			awayAttendance: number
			gamesPlayed: number
			averageAttendance: number
		}
	}
}

export {}
