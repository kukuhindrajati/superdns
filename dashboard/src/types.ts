export interface SystemStatus {
  version: string;
  uptime_seconds: number;
  resolver_active: boolean;
  block_count: number;
  block_source_url: string;
  last_blacklist_check: string;
  last_blacklist_update: string;
  next_blacklist_update: string;
  health: 'healthy' | 'degraded' | 'error';
  threads: number;
  memory_bytes: number;
}

export interface MetricPoint {
  timestamp: number;
  qps: number;
  cache_hit_pct: number;
  cache_miss_rate: number;
  blacklist_hits: number;
  expired: number;
  timeouts: number;
  discard_timeout: number;
  request_current: number;
  request_user: number;
  request_replies: number;
  request_exceeded: number;
  request_overwritten: number;
  request_avg: number;
}

export interface SystemSettings {
  update_interval: string;
  source_url: string;
  block_response_type: string;
  block_target_ip: string;
  safesearch_enabled: boolean;
  whitelist_domains: string[];
  local_records: Array<{ domain: string; type: string; value: string }>;
  dns_options: {
    dnssec: boolean;
    qname_minimisation: boolean;
    hide_version: boolean;
    serve_expired: boolean;
  };
  client_acl: Array<{ cidr: string; action: string }>;
}

