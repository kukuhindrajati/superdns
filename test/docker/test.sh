#!/bin/sh
set -eu

# DNS Trust installer smoke test in Docker.
#
# The bundle ships x86-64 ELF binaries, so the container runs on linux/amd64
# (emulated automatically on Apple Silicon / arm64 hosts).
#
# Usage:  test/docker/test.sh
#
# Environment overrides:
#   IMAGE            image name           (default: dnstrust-test)
#   CONTAINER        container name       (default: dnstrust-test)
#   ADMIN_PASSWORD   dashboard password   (default: DockerTest123)
#   KEEP=1           keep container+image after the run

PROJECT_ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
IMAGE=${IMAGE:-dnstrust-test}
CONTAINER=${CONTAINER:-dnstrust-test}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-DockerTest123}
KEEP=${KEEP:-0}

cd "$PROJECT_ROOT/test/docker"

echo "==> Building image"
docker build --platform linux/amd64 -t "$IMAGE" .

echo "==> Starting container"
docker rm -f "$CONTAINER" 2>/dev/null || true
docker run -d --name "$CONTAINER" \
    --platform linux/amd64 \
    --privileged \
    --cgroupns=host \
    --tmpfs /run \
    --tmpfs /run/lock \
    -v /sys/fs/cgroup:/sys/fs/cgroup:rw \
    "$IMAGE"

echo "==> Waiting for systemd"
ready=0
for _ in $(seq 1 30); do
    if docker exec "$CONTAINER" systemctl is-system-running 2>/dev/null |
        grep -qE '^(running|degraded)$'; then
        ready=1
        break
    fi
    sleep 1
done
test "$ready" -eq 1 || { echo "systemd did not come up" >&2; exit 1; }

echo "==> Copying bundle"
docker exec "$CONTAINER" rm -rf /tmp/dnstrust-release
docker cp "$PROJECT_ROOT" "$CONTAINER:/tmp/dnstrust-release"

echo "==> Seeding a host-owned firewall configuration"
docker exec "$CONTAINER" sh -c '
printf "%s\n" "#!/usr/sbin/nft -f" "# host-owned-firewall-sentinel" > /etc/nftables.conf
systemctl disable --now nftables.service >/dev/null 2>&1 || true
'

echo "==> Seeding a legacy Local overrides entry"
docker exec "$CONTAINER" sh -c '
mkdir -p /etc/unbound
printf "%s\n" '\''local-zone: "legacy-override.example." whitelist'\'' > /etc/unbound/local.conf
'

echo "==> Running install.sh"
if ! docker exec "$CONTAINER" sh -c \
    "cd /tmp/dnstrust-release && printf '%s\n' '$ADMIN_PASSWORD' | script -qec './install.sh' /dev/null"; then
    echo "install.sh FAILED" >&2
    docker logs --tail 50 "$CONTAINER" 2>&1 || true
    exit 1
fi

echo "==> Verifying services and behavior"
docker exec "$CONTAINER" sh -c '
set -eu
test ! -e /lib/systemd/system/qemu-guest-agent.service || {
    echo "test image unexpectedly contains qemu-guest-agent" >&2
    exit 1
}
for u in dnstrust-unbound.service dnstrust-admin.service \
         dnstrust-admin-collect.timer dnstrust-admin-worker.path \
         unbound-blacklist-update.timer; do
    systemctl is-active "$u" >/dev/null || { echo "service not active: $u" >&2; exit 1; }
done
grep -q "host-owned-firewall-sentinel" /etc/nftables.conf || {
    echo "host firewall configuration was overwritten" >&2
    exit 1
}
systemctl is-active --quiet nftables.service && {
    echo "inactive host firewall service was unexpectedly activated" >&2
    exit 1
}
IP=$(hostname -I | awk "{print \$1}")
/usr/local/sbin/dnstrust-admin version | grep -q "0.11.1" || {
    echo "unexpected dashboard version" >&2
    exit 1
}
dig @"$IP" example.com A +short +time=5 +tries=1 | grep -q . || { echo "dns resolution failed" >&2; exit 1; }
code=$(curl -sk -o /dev/null -w "%{http_code}" "https://$IP:9080/login")
test "$code" = 200 || { echo "dashboard unreachable (http $code)" >&2; exit 1; }
/usr/local/sbin/verify-dnstrust-hot-remap | grep -q "^PASS hot-remap " || {
    echo "CDB hot-remap verification failed" >&2
    exit 1
}
grep -Fqx '\''local-zone: "legacy-override.example." whitelist'\'' /etc/unbound/whitelist.conf || {
    echo "legacy Local overrides entry was not migrated" >&2
    exit 1
}
test ! -e /etc/unbound/local.conf || {
    echo "retired local.conf still exists" >&2
    exit 1
}
! grep -q '\''/etc/unbound/local.conf'\'' /etc/unbound/unbound.conf || {
    echo "retired local.conf is still included" >&2
    exit 1
}
echo "ALL CHECKS PASSED"
'

if [ "$KEEP" -ne 1 ]; then
    echo "==> Cleaning up"
    docker rm -f "$CONTAINER" >/dev/null
    docker rmi "$IMAGE" >/dev/null 2>&1 || true
fi

echo "OK"
