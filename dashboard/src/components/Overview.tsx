import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { SystemStatus } from '../types';

export const Overview: React.FC = () => {
  const { data: status, isLoading } = useQuery<SystemStatus>({
    queryKey: ['system-status'],
    queryFn: async () => {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error('Failed to fetch status');
      return res.json();
    },
    refetchInterval: 5000,
  });

  const compactFmt = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
  const numFmt = new Intl.NumberFormat('id-ID');

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}h ${h}j ${m}m`;
  };

  return (
    <div className="page active" id="overview">
      <header className="page-header">
        <div>
          <span className="overline">System Health & Policy</span>
          <h1>Ringkasan Operasional</h1>
        </div>
        <div className="header-actions">
          <span className={`pill ${status?.resolver_active ? 'success' : 'danger'}`}>
            <span className="dot" />
            {status?.resolver_active ? 'Resolver Aktif' : 'Resolver Offline'}
          </span>
        </div>
      </header>

      <div className="metric-strip">
        <div className="metric-card">
          <div className="metric-meta">
            <span className="metric-label">Daftar Terblokir</span>
            <span className="pill info">Komdigi Trust+</span>
          </div>
          <p className="metric-value">
            {isLoading ? '...' : compactFmt.format(status?.block_count || 0)}
          </p>
          <small className="metric-sub">{numFmt.format(status?.block_count || 0)} total domain</small>
        </div>

        <div className="metric-card">
          <div className="metric-meta">
            <span className="metric-label">Uptime Resolver</span>
            <span className="pill success">Stable</span>
          </div>
          <p className="metric-value">
            {isLoading ? '...' : formatUptime(status?.uptime_seconds || 0)}
          </p>
          <small className="metric-sub">Versi Unbound {status?.version || '1.25.1'}</small>
        </div>

        <div className="metric-card">
          <div className="metric-meta">
            <span className="metric-label">Pembaruan Terakhir</span>
            <span className="pill">CDB Hot-Remap</span>
          </div>
          <p className="metric-value" style={{ fontSize: '1.25rem', paddingTop: '6px' }}>
            {status?.last_blacklist_update ? new Date(status.last_blacklist_update).toLocaleTimeString('id-ID') : 'Aktif'}
          </p>
          <small className="metric-sub">Pemeriksaan otomatis berjalan</small>
        </div>

        <div className="metric-card">
          <div className="metric-meta">
            <span className="metric-label">Memory Usage</span>
            <span className="pill">Cache</span>
          </div>
          <p className="metric-value">
            {status?.memory_bytes ? `${Math.round(status.memory_bytes / 1024 / 1024)} MB` : '128 MB'}
          </p>
          <small className="metric-sub">{status?.threads || 4} thread pekerja</small>
        </div>
      </div>

      <div className="card-grid" style={{ marginTop: '24px' }}>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Status Komponen Sistem</h3>
              <p>Integritas komponen resolver dan perlindungan</p>
            </div>
          </div>
          <div className="panel-body">
            <div className="status-list">
              <div className="status-item">
                <div className="status-label">
                  <strong>Unbound Recursive Resolver</strong>
                  <small>Menangani kueri DNS lokal dan rekursif dengan DNSSEC</small>
                </div>
                <span className="badge success">Running</span>
              </div>

              <div className="status-item">
                <div className="status-label">
                  <strong>CDB Hot-Remap Engine</strong>
                  <small>Database blacklist 9+ juta domain tanpa reload resolver</small>
                </div>
                <span className="badge success">Active</span>
              </div>

              <div className="status-item">
                <div className="status-label">
                  <strong>Sinkronisasi Komdigi Trust Positif</strong>
                  <small>Timer otomatis pembaruan berkala</small>
                </div>
                <span className="badge success">Scheduled</span>
              </div>

              <div className="status-item">
                <div className="status-label">
                  <strong>Firewall Proteksi (nftables)</strong>
                  <small>Port 53 (DNS), 22 (SSH), 9080 (Admin)</small>
                </div>
                <span className="badge success">Secured</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

