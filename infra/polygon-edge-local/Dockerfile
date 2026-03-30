FROM 0xpolygon/polygon-edge:1.3.2

WORKDIR /app

COPY --chmod=755 scripts /app/scripts

ENTRYPOINT ["/bin/sh", "/app/scripts/bootstrap.sh"]
