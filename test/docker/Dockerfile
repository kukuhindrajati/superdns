FROM debian:bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    systemd \
    systemd-sysv \
    systemd-resolved \
    openssh-server \
    nftables \
    dnsutils \
    unbound \
    unbound-anchor \
    netbase \
    curl \
    ca-certificates \
    openssl \
    nodejs \
    npm \
    util-linux \
    iproute2 \
    procps \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

STOPSIGNAL SIGRTMIN+3

CMD ["/sbin/init"]
