# 🐳 Docker Explained for This Project

> **Question:** How does Docker really work in the Ink Indexer project?

---

## 🎯 The Short Answer

Docker creates a **lightweight virtual machine** (container) that runs **PostgreSQL** in isolation. Your TypeScript code runs on your computer (Windows), and connects to PostgreSQL inside the Docker container.

---

## 📊 Visual Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Windows Computer                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Docker Desktop (running in background)      │   │
│  │                                                        │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │   Container: "ink-indexer-postgres"            │  │   │
│  │  │                                                 │  │   │
│  │  │   ┌─────────────────────────────────────────┐  │  │   │
│  │  │   │  PostgreSQL 15                          │  │  │   │
│  │  │   │  - Port 5432 (exposed to your machine)  │  │  │   │
│  │  │   │  - Database: "ink_indexer"              │  │  │   │
│  │  │   │  - User: "postgres" / Pass: "postgres"  │  │  │   │
│  │  │   └─────────────────────────────────────────┘  │  │   │
│  │  │                                                 │  │   │
│  │  │   ┌─────────────────────────────────────────┐  │  │   │
│  │  │   │  Volume (persistent storage)             │  │  │   │
│  │  │   │  Your data stays here even if container│  │  │   │
│  │  │   │  stops/restarts                         │  │  │   │
│  │  │   └─────────────────────────────────────────┘  │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │                                                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
│                            │ localhost:5432                 │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Your TypeScript Application                │   │
│  │                                                        │   │
│  │   npm run dev → Node.js → Prisma → PostgreSQL       │   │
│  │                                                        │   │
│  │   DATABASE_URL="postgresql://postgres:postgres@       │   │
│  │                       localhost:5432/ink_indexer"       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 Breaking Down docker-compose.yml

Let me explain each line of the `docker-compose.yml` file:

```yaml
version: '3.9'
```
**What:** Specifies the Docker Compose file format version.
**Why:** Different versions have different features. 3.9 is stable and widely supported.

```yaml
services:
```
**What:** Defines the "services" (containers) to run.
**Why:** You can have multiple services (PostgreSQL, Redis, etc.). Here we only have one.

```yaml
  postgres:
```
**What:** The name of our service.
**Why:** We can reference it as `postgres` in other Docker commands.

```yaml
    image: postgres:15-alpine
```
**What:** The Docker image to use.
**Breakdown:**
- `postgres` = The official PostgreSQL image
- `15` = Version 15 of PostgreSQL
- `alpine` = A tiny Linux distribution (keeps the image small: ~200MB vs ~400MB)

**This is like downloading a pre-built PostgreSQL server.**

```yaml
    container_name: ink-indexer-postgres
```
**What:** Gives the container a specific name.
**Why:** Easier to identify with `docker ps` commands.

```yaml
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ink_indexer
```
**What:** Environment variables inside the container.
**What they do:**
- `POSTGRES_USER` = Creates a user named "postgres"
- `POSTGRES_PASSWORD` = Sets the password for that user
- `POSTGRES_DB` = Creates a database named "ink_indexer"

**This is like configuring PostgreSQL on first install.**

```yaml
    ports:
      - "5432:5432"
```
**What:** Port mapping (HOST:CONTAINER)
**Breakdown:**
- Left `5432` = Port on YOUR Windows machine
- Right `5432` = Port inside the Docker container

**What this does:** Makes PostgreSQL accessible from your Windows machine at `localhost:5432`

```yaml
    volumes:
      - postgres_data:/var/lib/postgresql/data
```
**What:** Volume mounting for persistent storage.
**Breakdown:**
- `postgres_data` = Name of the volume (defined at bottom)
- `/var/lib/postgresql/data` = Where PostgreSQL stores data inside the container

**Why:** When you stop the container, your data is preserved. Without this, all data would be lost!

```yaml
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
```
**What:** Health check for the container.
**What it does:**
- Runs `pg_isready -U postgres` every 10 seconds
- If it fails 5 times in a row, marks container as "unhealthy"
- Waits up to 5 seconds for each check

**Why:** Docker knows when PostgreSQL is actually ready to accept connections.

```yaml
volumes:
  postgres_data:
    driver: local
```
**What:** Defines the named volume.
**Why:** Creates a persistent storage location managed by Docker.

---

## 🚀 What Happens When You Run `docker compose up -d`

### Step 1: Docker Checks for the Image
```
Docker: "Do I have postgres:15-alpine downloaded?"
You: "No"
Docker: "Downloading from Docker Hub..."
```

### Step 2: Docker Creates the Container
```
Docker: "Creating a new container from the image"
Docker: "Setting environment variables (POSTGRES_USER, etc.)"
Docker: "Setting up port mapping (5432:5432)"
Docker: "Mounting the volume for persistent storage"
```

### Step 3: Docker Starts the Container
```
Docker: "Starting PostgreSQL inside the container"
PostgreSQL: "I'm starting up..."
PostgreSQL: "I'm ready for connections!"
```

### Step 4: Health Check Runs
```
Docker: "Is PostgreSQL ready? (healthcheck)"
PostgreSQL: "Yes! (pg_isready returns success)"
Docker: "Container is healthy! ✓"
```

### Step 5: Your App Can Now Connect
```
Your App: "Connecting to postgresql://postgres:postgres@localhost:5432/ink_indexer"
Docker: "Forwarding localhost:5432 to container's 5432"
PostgreSQL: "Accepting connection..."
```

---

## 🎮 Common Docker Commands

### Start the database
```bash
docker compose up -d
```
- `-d` = "detached mode" (runs in background)

### View running containers
```bash
docker ps
```
Output:
```
CONTAINER ID   IMAGE                  STATUS         NAMES
abc123         postgres:15-alpine     Up 5 minutes    ink-indexer-postgres
```

### View logs
```bash
docker compose logs postgres
```
See everything PostgreSQL is printing!

### Stop the database
```bash
docker compose down
```
Stops and removes the container. Data is preserved in the volume.

### Stop AND delete data
```bash
docker compose down -v
```
**WARNING:** This deletes your data! The `-v` flag removes volumes.

### Restart the database
```bash
docker compose restart
```

---

## 🤔 Why Not Just Install PostgreSQL Directly?

### With Docker (This Project):
✅ **Isolated** - Doesn't interfere with system PostgreSQL
✅ **Reproducible** - Same environment for everyone
✅ **Easy cleanup** - `docker compose down` and it's gone
✅ **Version-locked** - Always PostgreSQL 15, never updates unexpectedly
✅ **Cross-platform** - Works on Windows, Mac, Linux the same way

### Without Docker (Direct Install):
❌ **System-wide** - Affects entire system
❌ **Version conflicts** - Might clash with other PostgreSQL installs
❌ **Hard to remove** - Leaves files all over your system
❌ **OS-specific** - Different setup on Windows vs Mac vs Linux

---

## 🔌 How Your App Connects

### In .env file:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ink_indexer"
```

### What each part means:
- `postgresql://` = Protocol (we're using PostgreSQL)
- `postgres:` (before @) = Username
- `postgres:` (after @) = Password
- `localhost` = Host (your Windows machine, forwarded to Docker)
- `5432` = Port (forwarded to container's 5432)
- `ink_indexer` = Database name

### When your code runs:
```typescript
// In your code
await prisma.$connect();

// What happens:
// 1. Prisma reads DATABASE_URL from .env
// 2. Opens connection to localhost:5432
// 3. Docker forwards to container's 5432
// 4. PostgreSQL accepts the connection
// 5. Queries execute!
```

---

## 🐛 Troubleshooting Common Issues

### Issue: "Connection refused"
```
Error: Can't reach database at localhost:5432
```

**Fix:**
```bash
# Check if Docker is running
docker ps

# If empty list:
docker compose up -d
```

### Issue: "Database doesn't exist"
```
Error: database "ink_indexer" does not exist
```

**Fix:**
```bash
# Run migrations to create tables
npx prisma migrate dev --name init
```

### Issue: "Port already in use"
```
Error: Port 5432 is already allocated
```

**Fix:**
```bash
# You might already have PostgreSQL running!
# Either:
# 1. Stop the other PostgreSQL, or
# 2. Change the port in docker-compose.yml:
#    ports:
#      - "5433:5432"  # Use 5433 instead
```

---

## 📚 Key Concepts Summary

| Concept | Analogy |
|---------|---------|
| **Image** | A template (like a class) |
| **Container** | An instance of the image (like an object) |
| **Volume** | Persistent storage (like a hard drive) |
| **Port Mapping** | Forwarding a door from container to your machine |
| **docker-compose.yml** | A recipe for what containers to run |

---

*For more details, see the [Docker documentation](https://docs.docker.com/compose/).*
