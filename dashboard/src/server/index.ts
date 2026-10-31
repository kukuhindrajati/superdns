import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyHttpProxy from '@fastify/http-proxy';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';

const PORT = Number(process.env.PORT) || 9080;
const CORE_BACKEND_URL = process.env.CORE_BACKEND_URL || 'http://127.0.0.1:9081';
const LOG_FILE_PATH = process.env.QUERY_LOG_FILE || '/var/log/dnstrust/queries.log';
const LOG_CONFIG_PATH = process.env.LOG_CONFIG_PATH || '/etc/unbound/logging.conf';

const server = Fastify({
  logger: true,
});

interface QueryLogEntry {
  id: string;
  time: string;
  domain: string;
  type: string;
  status: string;
  client: string;
  response: string;
  isBlocked: boolean;
}

// Function to parse Unbound query lines
function parseLogLine(line: string, index: number): QueryLogEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    const parts = trimmed.split(/\s+/);
    let time = new Date().toLocaleTimeString('id-ID');
    let client = '127.0.0.1';
    let domain = 'unknown';
    let type = 'A';
    let status = 'NOERROR';
    let response = '0.0 ms Cache hit';
    let isBlocked = false;

    // Search for client IP and domain
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(part) && i + 1 < parts.length) {
        client = part;
        domain = parts[i + 1].replace(/\.$/, '');
        if (i + 2 < parts.length) type = parts[i + 2];
        break;
      }
    }

    if (trimmed.includes('BLOCKED') || trimmed.includes('NXDOMAIN') || trimmed.includes('REFUSED')) {
      status = trimmed.includes('BLOCKED') ? 'BLOCKED' : 'NXDOMAIN';
      isBlocked = true;
    } else if (trimmed.includes('SERVFAIL')) {
      status = 'SERVFAIL';
    } else {
      status = 'NOERROR';
    }

    if (trimmed.includes('cache') || trimmed.includes('0.000000')) {
      response = '0.0 ms Cache hit';
    } else {
      response = '12.4 ms Upstream';
    }

    return {
      id: `${Date.now()}-${index}`,
      time,
      domain,
      type,
      status,
      client,
      response,
      isBlocked,
    };
  } catch {
    return null;
  }
}

async function main() {
  // 1. Custom Endpoint: GET /api/custom/query-logs
  server.get('/api/custom/query-logs', async (_req, reply) => {
    let logs: QueryLogEntry[] = [];
    let totalQueries = 0;
    let activeClientsSet = new Set<string>();
    let blockedCount = 0;
    let cacheHits = 0;
    let cacheMisses = 0;

    // 1. Coba ambil data statistik nyata dari Core Backend API (/api/metrics & /api/status)
    try {
      const [metricsRes, statusRes] = await Promise.all([
        fetch(`${CORE_BACKEND_URL}/api/metrics?range=hour`).catch(() => null),
        fetch(`${CORE_BACKEND_URL}/api/status`).catch(() => null),
      ]);

      if (metricsRes && metricsRes.ok) {
        const metricsData = await metricsRes.json();
        if (metricsData && Array.isArray(metricsData.points) && metricsData.points.length > 0) {
          const lastPoint = metricsData.points[metricsData.points.length - 1];
          if (lastPoint.qps) totalQueries += Math.round(lastPoint.qps * 3600);
          if (lastPoint.blacklist_hits) blockedCount += lastPoint.blacklist_hits;
        }
      }

      if (statusRes && statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData && statusData.latest) {
          const s = statusData.latest;
          if (s.cache_hits) cacheHits = s.cache_hits;
          if (s.cache_miss) cacheMisses = s.cache_miss;
          if (s.blacklist) blockedCount = s.blacklist;
          if (s.total_queries) totalQueries = s.total_queries;
        }
      }
    } catch {
      // Backend offline
    }

    // 2. Baca file queries.log asli dari disk
    if (fs.existsSync(LOG_FILE_PATH)) {
      try {
        const fileContent = fs.readFileSync(LOG_FILE_PATH, 'utf-8');
        const lines = fileContent.trim().split('\n').filter(Boolean);
        if (lines.length > 0) {
          totalQueries = Math.max(totalQueries, lines.length);

          const recentLines = lines.slice(-100).reverse();
          recentLines.forEach((line, idx) => {
            const parsed = parseLogLine(line, idx);
            if (parsed) {
              logs.push(parsed);
              activeClientsSet.add(parsed.client);
              if (parsed.isBlocked) blockedCount++;
            }
          });
        }
      } catch (err) {
        server.log.error(err, 'Gagal membaca log query Unbound');
      }
    }

    // Hitung Cache Hit Ratio Nyata
    let calculatedHitRatio = '0%';
    if (cacheHits + cacheMisses > 0) {
      const pct = (cacheHits / (cacheHits + cacheMisses)) * 100;
      calculatedHitRatio = `${pct.toFixed(1)}%`;
    } else if (logs.length > 0) {
      const hits = logs.filter((l) => l.response.includes('Cache hit')).length;
      calculatedHitRatio = `${((hits / logs.length) * 100).toFixed(0)}%`;
    }

    // Hitung policy enforcement rate
    const policyRate =
      totalQueries > 0 ? `${((blockedCount / totalQueries) * 100).toFixed(1)}%` : '0%';

    return reply.send({
      success: true,
      totalQueries: totalQueries,
      activeClients: activeClientsSet.size,
      blockedQueries: blockedCount,
      policyRate,
      cacheHitRatio: calculatedHitRatio,
      logs,
    });
  });

  // 2. Custom Endpoint: POST /api/custom/toggle-logging
  server.post<{ Body: { enabled: boolean } }>('/api/custom/toggle-logging', async (req, reply) => {
    const { enabled } = req.body || { enabled: true };
    const confContent = `# Logging configuration for Unbound queries
log-queries: ${enabled ? 'yes' : 'no'}
log-replies: ${enabled ? 'yes' : 'no'}
log-local-actions: ${enabled ? 'yes' : 'no'}
logfile: "${LOG_FILE_PATH}"
use-syslog: no
`;
    try {
      if (fs.existsSync(path.dirname(LOG_CONFIG_PATH))) {
        fs.writeFileSync(LOG_CONFIG_PATH, confContent, 'utf-8');
      }
      exec('/usr/local/sbin/dnstrust-control refresh', () => {});
      return reply.send({ success: true, enabled });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 3. Clear logs endpoint
  server.post('/api/custom/clear-logs', async (_req, reply) => {
    try {
      if (fs.existsSync(LOG_FILE_PATH)) {
        fs.writeFileSync(LOG_FILE_PATH, '', 'utf-8');
      }
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 4. Reverse proxy core /api requests to dnstrust-admin backend
  await server.register(fastifyHttpProxy, {
    upstream: CORE_BACKEND_URL,
    prefix: '/api',
    rewritePrefix: '/api',
  });

  // 5. Proxy auth endpoints
  await server.register(fastifyHttpProxy, {
    upstream: CORE_BACKEND_URL,
    prefix: '/login',
    rewritePrefix: '/login',
  });

  await server.register(fastifyHttpProxy, {
    upstream: CORE_BACKEND_URL,
    prefix: '/logout',
    rewritePrefix: '/logout',
  });

  // 6. Serve static built frontend
  const staticPath = path.join(process.cwd(), 'dist');
  await server.register(fastifyStatic, {
    root: staticPath,
    prefix: '/',
  });

  server.setNotFoundHandler((_req, reply) => {
    reply.sendFile('index.html');
  });

  try {
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[SuperDNS Reverse Proxy] Running on https://0.0.0.0:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
