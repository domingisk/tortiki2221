FROM alpine:3.19

ARG PB_VERSION=0.22.20

RUN apk add --no-cache unzip curl ca-certificates && \
    curl -fsSL \
      "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
      -o /tmp/pb.zip && \
    unzip /tmp/pb.zip pocketbase -d /pb && \
    rm /tmp/pb.zip && \
    chmod +x /pb/pocketbase

COPY frontend/  /pb/pb_public/
COPY pb_hooks/  /pb/pb_hooks/

# $PORT — Railway динамически задаёт порт
CMD ["/bin/sh", "-c", "/pb/pocketbase serve --http=0.0.0.0:${PORT:-8080} --dir=/pb/pb_data"]
