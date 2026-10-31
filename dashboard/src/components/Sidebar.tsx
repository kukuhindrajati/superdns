import React from 'react';

interface SidebarProps {
  currentPage: string;
  onSelectPage: (page: string) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onSelectPage, onLogout }) => {
  const navGroups = [
    {
      title: 'Observe',
      items: [
        {
          id: 'overview',
          label: 'Overview',
          icon: (
            <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          ),
        },
        {
          id: 'statistics',
          label: 'Metrics explorer',
          icon: (
            <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 19V9M10 19V5M16 19v-7M22 19V3" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Policy',
      items: [
        {
          id: 'update',
          label: 'Blacklist source',
          icon: (
            <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2M7 3 4 6" />
            </svg>
          ),
        },
        {
          id: 'blockpage',
          label: 'Block response',
          icon: (
            <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3 20 6v6c0 5-3.4 8-8 10-4.6-2-8-5-8-10V6zM8.5 8.5l7 7M15.5 8.5l-7 7" />
            </svg>
          ),
        },
        {
          id: 'safesearch',
          label: 'SafeSearch',
          icon: (
            <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m15.5 15.5 5 5M8 10.5l1.7 1.7 3.6-3.8" />
            </svg>
          ),
        },
        {
          id: 'whitelist',
          label: 'Whitelist',
          icon: (
            <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="m8 12 2.7 2.7L16.5 9" />
            </svg>
          ),
        },
        {
          id: 'local-dns-records',
          label: 'Local DNS records',
          icon: (
            <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 4h10l4 4v12H5z" />
              <path d="M15 4v5h4M8 13h8M8 17h6" />
            </svg>
          ),
        },
        {
          id: 'dns-options',
          label: 'DNS options',
          icon: (
            <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3 20 6v6c0 5-3.4 8-8 10-4.6-2-8-5-8-10V6z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          ),
        },
        {
          id: 'acl',
          label: 'Client access',
          icon: (
            <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="9" cy="8" r="3" />
              <path d="M3 20v-2c0-3 2.4-5 6-5s6 2 6 5v2M16 5a3 3 0 0 1 0 6M17 14c2.5.4 4 1.9 4 4v2" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Operate',
      items: [
        {
          id: 'domain-test',
          label: 'DNS inspector',
          icon: (
            <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m15.5 15.5 5 5" />
            </svg>
          ),
        },
        {
          id: 'operations',
          label: 'Operations',
          icon: (
            <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
            </svg>
          ),
        },
        {
          id: 'activity',
          label: 'Activity log',
          icon: (
            <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 6h11M9 12h11M9 18h11" />
              <circle cx="4" cy="6" r="1" />
              <circle cx="4" cy="12" r="1" />
              <circle cx="4" cy="18" r="1" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          id: 'security',
          label: 'Security',
          icon: (
            <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="10" width="14" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
            </svg>
          ),
        },
      ],
    },
  ];

  return (
    <aside id="sidebar" className="sidebar" aria-label="Main navigation">
      <div className="brand-panel">
        <a href="#overview" className="brand-link" onClick={() => onSelectPage('overview')}>
          <img
            className="brand-logo"
            src="/assets/web/zetdns-logo-adaptive.svg"
            alt="SuperDNS · DNS Trust+ Nusantara"
          />
        </a>
      </div>

      <nav className="nav-stack">
        {navGroups.map((group) => (
          <div key={group.title} className="nav-group">
            <p>{group.title}</p>
            {group.items.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={currentPage === item.id ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  onSelectPage(item.id);
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </a>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="button link"
          style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--text-soft)' }}
          onClick={onLogout}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
};

