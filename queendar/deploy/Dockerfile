# Queendar safety app — static SPA on :3011 (replaces performer portal)
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/
EXPOSE 3011
HEALTHCHECK --interval=10s --timeout=5s --retries=6 --start-period=5s \
  CMD wget -qO- http://127.0.0.1:3011/api/health || exit 1
