---
name: postgres
description: "Execute read-only SQL queries against multiple PostgreSQL databases. Use when: (1) querying PostgreSQL databases, (2) exploring database schemas/tables, (3) running SELECT queries for data analysis, (4) checking database contents."
---

# PostgreSQL Read-Only Query Skill

Execute safe, read-only queries against configured PostgreSQL databases.

## Setup

Create `connections.json` in the skill directory or `~/.config/claude/postgres-connections.json`.

```json
{
  "databases": [
    {
      "name": "production",
      "description": "Main app database",
      "host": "HOST",
      "port": 5432,
      "database": "DB",
      "user": "USER",
      "password": "PASS",
      "sslmode": "require"
    }
  ]
}
```

## Usage

### Query a database
```bash
python3 scripts/query.py --db production --query "SELECT * FROM users LIMIT 10"
```

### List tables
```bash
python3 scripts/query.py --db production --tables
```

## Safety Features

- **Read-only session**: Connection uses PostgreSQL `readonly=True` mode.
- **Query validation**: Only SELECT, SHOW, EXPLAIN, WITH queries allowed.
- **Memory protection**: Max 10,000 rows per query.
