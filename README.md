# ft_transcendence

## Quick guide to running Transendence

### 1. Generate certs:

``` bash
chmod +x ./scripts/certs.sh && ./scripts/certs.sh
```

### 2. Start all the containers:

``` bash
docker compose up -d --build
```

### 3. Access the services:

* Frontend: http://localhost:4200
* Backend: http://localhost:3000
* Databank: http://localhost:3001

### 4. Stop everything:

``` bash
docker compose down
```

### Other usefull commands:

``` bash
# start prebuilt containers (detached)
docker compose up -d

# rebuild when Dockerfiles/code change
docker compose up -d --build

# view logs (all services)
docker compose logs -f

# view logs (one service)
docker compose logs -f backend

# stop without removing
docker compose stop

# stop and remove containers/networks
docker compose down

# remove everything + named volumes (⚠️ deletes data)
docker compose down -v

# shell into a running container
docker compose exec backend bash
```

