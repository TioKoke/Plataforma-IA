import { useState } from 'react';
import { Bot, ClipboardList, Video, Settings, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

import AgentsTab from './admin/AgentsTab';
import BacklogsTab from './admin/BacklogsTab';
import ConversationsTab from './admin/ConversationsTab';
import VideosTab from './admin/VideosTab';

const AdminPage = () => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'agents' | 'backlogs' | 'conversations' | 'videos'>('agents');

  if (!isAdmin) {
    return (
      <div className="ck-container max-w-xl py-20">
        <div className="ck-card p-12 text-center">
          <div className="size-14 rounded-2xl bg-bg-inset grid place-items-center mx-auto mb-4">
            <ShieldAlert className="size-7 text-ink-muted" />
          </div>
          <h2 className="ck-display text-[24px]">Acceso denegado</h2>
          <p className="mt-2 text-sm text-ink-muted">
            No tienes permisos de administrador para ver esta página.
          </p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'agents',   label: 'Agentes',         icon: Bot },
    { id: 'videos',   label: 'Videos',          icon: Video },
    { id: 'backlogs', label: 'Requerimientos',  icon: ClipboardList },
  ] as const;

  return (
    <div className="ck-container py-10">
      {/* Header — design system */}
      <div className="mb-8">
        <span className="ck-pill mb-3">
          <Settings className="size-3" />
          <span className="ck-mono text-[11px] tracking-wider text-ink-2">
            PANEL DE ADMINISTRACIÓN
          </span>
        </span>
        <h1 className="ck-display text-[40px] leading-tight">
          Administración
        </h1>
        <p className="text-base text-ink-muted mt-2">
          Gestiona el catálogo de agentes, backlogs y supervisa las interacciones.
        </p>
      </div>

      <div className="ck-card overflow-hidden">
        <div className="border-b border-border-soft">
          <nav className="flex px-4" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-3.5 px-4 border-b-2 font-medium text-[13px] transition-colors ${
                    active
                      ? 'text-ink'
                      : 'border-transparent text-ink-muted hover:text-ink-2'
                  }`}
                  style={active ? { borderColor: 'var(--primary-ck)', color: 'var(--primary-ck)' } : undefined}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="min-h-[500px]">
          {activeTab === 'agents' && <AgentsTab />}
          {activeTab === 'videos' && <VideosTab />}
          {activeTab === 'backlogs' && <BacklogsTab />}
          {activeTab === 'conversations' && <ConversationsTab />}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
