FROM alpine:3.20

RUN apk add --no-cache nodejs iptables curl

WORKDIR /app

COPY dist/src /app/dist/src

EXPOSE 8080

CMD ["node", "/app/dist/src/testAgent/server.js"]
