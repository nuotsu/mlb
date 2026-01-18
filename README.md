# MLB Scorebug & MLB Stats API Playground

## MLB Scorebug

- https://mlb.theohtani.com/schedule

_Coming soon..._

## MLB Stats API Playground

- https://mlb.theohtani.com/api/playground

Replace `<statsapi.mlb.com>/api/...` with `<mlb.theohtani.com>/api/...` to view API responses in the playground.

### Examples

![Games at Dodger Stadium for April 2026](/static/games-at-dodger-stadium-april-2026.png)

> Games at Dodger Stadium for April 2026

- [https://statsapi.mlb.com/api/...](https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=2026-04-01&endDate=2026-04-30&season=2026&teamId=119&venueIds=22&fields=totalGames,dates,games,officialDate,dayNight,teams,team,name)
- [https://mlb.theohtani.com/api/...](https://mlb.theohtani.com/api/v1/schedule?sportId=1&startDate=2026-04-01&endDate=2026-04-30&season=2026&teamId=119&venueIds=22&fields=totalGames,dates,games,officialDate,dayNight,teams,team,name)

## Credits & References

- https://github.com/toddrob99/MLB-StatsAPI/wiki/Endpoints
- https://gdx.mlb.com/components/copyright.txt

## Archive

- https://sb3.theohtani.com
- https://clubhouse.theohtani.com
- https://sb2.theohtani.com
- https://sb1.theohtani.com

## TODO

- date picker for /schedule/<date>
- code folding > show children count (use `mutationObserver` attachment)
