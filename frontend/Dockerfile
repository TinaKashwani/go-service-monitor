# syntax=docker/dockerfile:1

FROM node:20.19.4-alpine3.22 AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY angular.json karma.conf.js tsconfig*.json ./
COPY src ./src

RUN npm run build -- --configuration production

FROM nginxinc/nginx-unprivileged:1.29.0-alpine3.22

COPY --from=builder --chown=101:101 \
    /app/dist/go-service-monitor-frontend/browser \
    /usr/share/nginx/html
COPY --chown=101:101 nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chown=101:101 docker-entrypoint.sh /usr/local/bin/frontend-entrypoint

USER root
RUN chmod 0555 /usr/local/bin/frontend-entrypoint \
    && rm -f /etc/nginx/conf.d/default.conf \
    && ln -s /tmp/frontend-default.conf /etc/nginx/conf.d/default.conf
USER 101

ENV BACKEND_URL=http://backend:8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/frontend-health || exit 1

ENTRYPOINT ["/usr/local/bin/frontend-entrypoint"]

