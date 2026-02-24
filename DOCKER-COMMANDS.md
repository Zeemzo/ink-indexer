# 🚀 Quick Docker Commands Reference

> For the Ink Indexer project

---

## 🎯 Common Commands

### Start Everything (PostgreSQL only)
```bash
docker compose up -d
```
**What it does:** Starts PostgreSQL in background
**First run:** Downloads the image (~200MB), then starts

### Check What's Running
```bash
docker ps
```
**Shows:** All running containers with status

### View Logs
```bash
docker compose logs postgres          # All logs
docker compose logs -f postgres       # Follow logs (live)
docker compose logs --tail=50 postgres # Last 50 lines
```

### Stop Everything
```bash
docker compose down
```
**What it does:** Stops containers, keeps data

### Stop Everything AND Delete Data
```bash
docker compose down -v
```
**WARNING:** Deletes all data! Use only if you want a fresh start.

### Restart Without Losing Data
```bash
docker compose restart
```

---

## 🔍 Troubleshooting

### "Connection refused" Error
```bash
# Check if Docker is running
docker ps

# If empty, start it:
docker compose up -d
```

### "Port 5432 already in use"
```bash
# Something else is using port 5432
# Option 1: Stop the other service
# Option 2: Change port in docker-compose.yml:
#   ports:
#     - "5433:5432"  # Use 5433 instead
```

### "Database doesn't exist"
```bash
# Run migrations to create database and tables
npx prisma migrate dev --name init
```

### View What's Inside Container
```bash
docker compose exec postgres psql -U postgres -d ink_indexer
```
**What it does:** Opens PostgreSQL shell inside container

### Remove Everything and Start Fresh
```bash
# Stop and remove containers
docker compose down

# Remove volumes (deletes data)
docker volume rm ink-indexer_postgres_data

# Start fresh
docker compose up -d
npx prisma migrate dev --name init
```

---

## 📊 Check Container Health

```bash
# Check container status
docker compose ps

# Detailed health check
docker inspect ink-indexer-postgres | grep -A 10 Health
```

---

## 💾 Backup & Restore Data

### Backup Database
```bash
docker compose exec postgres pg_dump -U postgres ink_indexer > backup.sql
```

### Restore Database
```bash
cat backup.sql | docker compose exec -T postgres psql -U postgres ink_indexer
```

---

## 🧹 Clean Up (When Done with Project)

```bash
# Stop containers
docker compose down

# Remove unused images (saves disk space)
docker image prune

# Remove unused volumes (frees space, deletes data)
docker volume prune
```

---

## Quick Start

```bash
# 1. Start database
docker compose up -d

# 2. Wait for "healthy" status
docker compose ps

# 3. Setup environment
cp .env.example .env

# 4. Generate Prisma client
npx prisma generate

# 5. Run migrations
npx prisma migrate dev --name init

# 6. Start your app
npm run dev
```

---

## 🔗 Useful Links

- **Docker Hub (postgres image):** https://hub.docker.com/_/postgres
- **Docker Compose Docs:** https://docs.docker.com/compose/
- **Prisma Docs:** https://www.prisma.io/docs

---

*Pro tip: Add these to your shell aliases or keep this file open for quick reference!*
