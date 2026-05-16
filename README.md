```
$$\      $$\ $$\       $$$$$$$\
$$$\    $$$ |$$ |      $$  __$$\
$$$$\  $$$$ |$$ |      $$ |  $$ |
$$\$$\$$ $$ |$$ |      $$$$$$$\ |
$$ \$$$  $$ |$$ |      $$  __$$\
$$ |\$  /$$ |$$ |      $$ |  $$ |
$$ | \_/ $$ |$$$$$$$$\ $$$$$$$  |
\__|     \__|\________|\_______/ .TheOhtani.com
```

# MLB (Mitchell's Live scoreBug)

> MLB Scorebug & MLB Stats API Playground

## Screenshots

Schedule view (with live data):
![game view](/static/screenshots/schedule.png)

Game details view:
![Game details view](/static/screenshots/game.png)

MLB Stats API Playground:
![Stats API Playground](/static/screenshots/playground.png)

> [!TIP]
> Replace `https://statsapi.mlb.com/api/v1/...` with `https://mlb.theohtani.com/api/v1/...` to show results in the API Playground.

## MCP

An [MCP](https://modelcontextprotocol.io) server that exposes the MLB Stats API — schedule, standings, player stats, transactions, and more — to any AI client.

### Setup

**Claude Desktop / Cursor / other MCP clients:**

Hosted HTTP MCP uses **POST only** (SSE `GET` is disabled to avoid Vercel function timeouts). Optional auth: set `MCP_SECRET` on Vercel and send `Authorization: Bearer <secret>`.

```json
{
  "mcpServers": {
    "mlb": {
      "url": "https://mlb.theohtani.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_SECRET"
      }
    }
  }
}
```

**Claude CLI:**
```sh
claude mcp add --transport http mlb https://mlb.theohtani.com/mcp
```

For local use, clone the repo and run `node mcp/dist/mcp/src/index.js` via stdio transport.

### Example prompts

> "Compare the last 7 days of transactions for contending teams — who made the most aggressive moves and what does it signal about their roster?"

> "Who are the top OPS hitters playing today, and how do their stats split between home and away games this season?"

## Credits & References

- https://github.com/toddrob99/MLB-StatsAPI/wiki/Endpoints
- Copyright 👉 https://gdx.mlb.com/components/copyright.txt

## Archive

- https://sb3.theohtani.com
- https://clubhouse.theohtani.com
- https://sb2.theohtani.com
- https://sb1.theohtani.com

## TODO

- code folding > show children count (use `mutationObserver` attachment)
