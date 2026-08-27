# Queendar — safety app

## Status

- **Product:** Queendar safety app (not Haven, not an IDE).
- **Live (wrong content today):** https://queendar.com / https://queendar.dannygc.cloud/  
  Currently serves `queendar-portal` as a “Sovereign Performance Hub” (Mystery Match / performers).
- **GitHub:** No Queendar repo exists under `dannyknightgc78-cloud` (checked all public repos). Source is almost certainly only on the machine running the Docker service.

## Find the source on your lab / Mac

The live health check reports:

```json
{ "service": "queendar-portal", "ai": { "base": "http://host.docker.internal:18001/v1" } }
```

That means the app is a **Docker container** on a host that can see `host.docker.internal`. On that machine run:

```bash
# Find the container
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}' | grep -i queen

# Inspect mount points (source bind-mounts)
docker inspect "$(docker ps -qf name=queen)" --format '{{json .Mounts}}' | jq .

# Or search the filesystem
mdfind -name queendar 2>/dev/null
find ~ /opt /srv /var/www -maxdepth 4 -iname '*queendar*' 2>/dev/null

# If it was ever a git repo
find ~ -maxdepth 5 -type d -name '.git' 2>/dev/null | while read g; do
  git -C "$(dirname "$g")" remote -v 2>/dev/null | grep -qi queen && echo "$(dirname "$g")"
done
```

If you find the folder, either:

1. `git remote add origin … && git push` a new GitHub repo, then attach this Cloud Agent to it, or  
2. Reply here with the path / zip the project and we rebuild from that.

## This repo (`new-ide`)

Placeholder only until Queendar source is recovered or we rebuild the safety app here from scratch.
