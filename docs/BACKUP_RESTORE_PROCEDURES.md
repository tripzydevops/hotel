# Database Backup and Restore Procedures (InsForge)

As HotelPlus scales, our reliance on the InsForge database for both relational data (users, hotels) and vector data (`pgvector` embeddings) makes disaster recovery procedures paramount.

## 1. Automated Point-in-Time Recovery (PITR)
InsForge automatically takes daily physical backups and retains WAL (Write-Ahead Log) files for Point-in-Time Recovery.

### Enabling PITR
1. Navigate to the InsForge Project Dashboard.
2. Go to **Database > Backups**.
3. Ensure "Point-in-Time Recovery" is enabled. (Note: This may require an upgraded InsForge plan).

### Restoring via PITR
If a critical failure occurs (e.g., accidental table drop or corrupted embeddings):
1. Navigate to **Database > Backups** in the InsForge dashboard.
2. Select **Restore to a specific time**.
3. Choose the timestamp immediately prior to the failure event.
4. Confirm the restore. *Note: During the restore, the database will be offline for a brief period.*

## 2. Manual Logical Backups (`pg_dump`)
For archiving or migrating environments, a logical backup is necessary. Because InsForge exposes a standard Postgres connection string, we can use `pg_dump`.

### Taking a Logical Backup
```bash
# Retrieve the connection string from InsForge (Database > Connection Pooling)
export DATABASE_URL="postgres://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.insforge.com:5432/postgres"

# Execute pg_dump, excluding system schemas
pg_dump $DATABASE_URL \
  --schema=public \
  --schema=auth \
  --clean \
  --if-exists \
  --format=c \
  --file=tripzy_backup_$(date +%Y-%m-%d).dump
```

### Restoring from a Logical Backup
If you need to restore to a staging environment or recover a dropped database:
```bash
# Restore the dump file using pg_restore
pg_restore -d $STAGING_DATABASE_URL \
  --clean \
  --if-exists \
  1 jobs \
  tripzy_backup_YYYY-MM-DD.dump
```

## 3. Disaster Recovery Scenario: Corrupted Vectors
If the `pgvector` index becomes corrupted but relational data is fine, do NOT restore the entire database. Instead:
1. Re-run the python agent script to regenerate embeddings from the text.
2. Rebuild the HNSW index concurrently:
   ```sql
   REINDEX INDEX CONCURRENTLY idx_hotels_embedding;
   ```
