import React, { useEffect } from 'react';
import { DASHBOARD_RAW_HTML } from './dashboardRawHtml';

export const ExactDashboard: React.FC = () => {
  useEffect(() => {
    // 1. Inisialisasi logika live untuk query log & toggle options
    const initLiveFeatures = () => {
      const toggle = document.getElementById('queryLogEnabled') as HTMLInputElement | null;
      const refreshBtn = document.getElementById('refreshQueryLog');
      const clearBtn = document.getElementById('clearQueryLog');
      const exportBtn = document.getElementById('exportCsvBtn');
      const tableBody = document.getElementById('queryLogTableBody');
      const totalEl = document.getElementById('logTotalQueries');
      const clientsEl = document.getElementById('logActiveClients');
      const blockedEl = document.getElementById('logBlockedQueries');
      const cacheEl = document.getElementById('logCacheHitRatio');
      const searchInput = document.getElementById('queryLogSearch') as HTMLInputElement | null;
      const statusSelect = document.getElementById('queryLogFilterStatus') as HTMLSelectElement | null;
      const typeSelect = document.getElementById('queryLogFilterType') as HTMLSelectElement | null;

      let currentLogs: any[] = [];

      // Event listener saat toggle diubah di DNS options
      if (toggle) {
        toggle.addEventListener('change', async () => {
          try {
            await fetch('/api/custom/toggle-logging', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ enabled: toggle.checked }),
            });
          } catch (e) {
            console.error('Gagal update status log:', e);
          }
        });
      }

      // Render fungsi tabel sesuai filter (Status, Type, Search)
      const renderTable = () => {
        if (!tableBody) return;
        const search = (searchInput?.value || '').toLowerCase();
        const selectedStatus = statusSelect?.value || 'all';
        const selectedType = typeSelect?.value || 'all';

        const filtered = currentLogs.filter((item: any) => {
          // Search filter
          const matchesSearch =
            item.domain.toLowerCase().includes(search) || item.client.includes(search);
          if (!matchesSearch) return false;

          // Type filter
          if (selectedType !== 'all' && item.type.toUpperCase() !== selectedType.toUpperCase()) {
            return false;
          }

          // Status filter
          if (selectedStatus === 'allowed' && item.status !== 'NOERROR') return false;
          if (selectedStatus === 'blocked' && !item.isBlocked) return false;
          if (selectedStatus === 'nxdomain' && item.status !== 'NXDOMAIN') return false;
          if (selectedStatus === 'servfail' && item.status !== 'SERVFAIL') return false;

          return true;
        });

        if (filtered.length === 0) {
          tableBody.innerHTML = `
            <tr>
              <td colspan="6" style="padding: 32px; text-align: center; color: var(--muted);">
                Belum ada kueri DNS yang tercatat. Aktifkan DNS Query Logging di menu DNS Options untuk mulai merekam aktivitas.
              </td>
            </tr>
          `;
          return;
        }

        tableBody.innerHTML = filtered
          .map(
            (item: any) => `
          <tr style="border-bottom: 1px solid var(--border-subtle);">
            <td style="padding: 14px; font-family: monospace; color: var(--muted);">${item.time}</td>
            <td style="padding: 14px; font-weight: 500; color: var(--text);">${item.domain}</td>
            <td style="padding: 14px; color: var(--muted);">${item.type}</td>
            <td style="padding: 14px;">
              <span style="color: ${item.isBlocked ? '#ff7b88' : '#4ed597'}; font-weight: 600;">
                • ${item.status}
              </span>
            </td>
            <td style="padding: 14px; font-family: monospace; color: #50d5c4;">${item.client}</td>
            <td style="padding: 14px;">
              <span style="color: #4ed597;">${item.response.split(' ')[0]} ms</span>
              <small style="color: var(--muted); margin-left: 4px;">${item.response.split(' ').slice(1).join(' ')}</small>
            </td>
          </tr>
        `
          )
          .join('');
      };

      // Function untuk fetch data log terbaru secara REAL dari backend
      const fetchLogs = async () => {
        try {
          const res = await fetch('/api/custom/query-logs');
          if (!res.ok) return;
          const data = await res.json();

          if (data && data.success) {
            // Pasang angka REAL
            if (totalEl) totalEl.textContent = new Intl.NumberFormat('id-ID').format(data.totalQueries || 0);
            if (clientsEl) clientsEl.textContent = String(data.activeClients || 0);
            if (blockedEl) blockedEl.textContent = String(data.blockedQueries || 0);
            if (cacheEl) cacheEl.textContent = data.cacheHitRatio || '0%';

            // Update sub-label policy enforcement rate jika ada
            const blockedCard = blockedEl?.closest('.health-card');
            if (blockedCard) {
              const sub = blockedCard.querySelector('small');
              if (sub) sub.textContent = `${data.policyRate || '0%'} policy enforcement rate`;
            }

            if (Array.isArray(data.logs)) {
              currentLogs = data.logs;
              renderTable();
            }
          }
        } catch {
          // ignore jika backend offline
        }
      };

      // Fungsikan tombol Refresh log (kotak biru)
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          refreshBtn.textContent = '⏳ Refreshing...';
          fetchLogs().then(() => {
            setTimeout(() => {
              refreshBtn.textContent = '↻ Refresh log';
            }, 500);
          });
        });
      }

      // Fungsikan tombol Clear all logs (kotak biru)
      if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
          if (confirm('Yakin ingin membersihkan semua query log DNS?')) {
            await fetch('/api/custom/clear-logs', { method: 'POST' });
            currentLogs = [];
            renderTable();
            if (totalEl) totalEl.textContent = '0';
            if (clientsEl) clientsEl.textContent = '0';
            if (blockedEl) blockedEl.textContent = '0';
            if (cacheEl) cacheEl.textContent = '0%';
          }
        });
      }

      // Export CSV
      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          const rows = [
            ['TIME', 'DOMAIN', 'TYPE', 'STATUS', 'CLIENT', 'RESPONSE'],
            ...currentLogs.map((l) => [l.time, l.domain, l.type, l.status, l.client, l.response]),
          ];
          const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
          const encodedUri = encodeURI(csvContent);
          const link = document.createElement('a');
          link.setAttribute('href', encodedUri);
          link.setAttribute('download', 'dns_query_log.csv');
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        });
      }

      // Event listener input & filter
      if (searchInput) searchInput.addEventListener('input', renderTable);
      if (statusSelect) statusSelect.addEventListener('change', renderTable);
      if (typeSelect) typeSelect.addEventListener('change', renderTable);

      // Interval polling otomatis setiap 2 detik
      const timer = setInterval(fetchLogs, 2000);
      fetchLogs();

      return () => clearInterval(timer);
    };

    // Load original script
    const existingScript = document.getElementById('superdns-app-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'superdns-app-script';
      script.src = '/assets/web/app.js';
      script.defer = true;
      document.body.appendChild(script);
    }

    const timerClean = initLiveFeatures();
    return () => {
      if (timerClean) timerClean();
    };
  }, []);

  return (
    <div
      style={{ width: '100%', height: '100%' }}
      dangerouslySetInnerHTML={{ __html: DASHBOARD_RAW_HTML }}
    />
  );
};
