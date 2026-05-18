import { useState } from 'react';
import { Bot, ClipboardList, Video } from 'lucide-react';
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
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Acceso Denegado</h2>
                <p className="text-gray-600 text-center max-w-md">
                    No tienes permisos de administrador para ver esta página.
                </p>
            </div>
        );
    }

    const tabs = [
        { id: 'agents', label: 'Agentes', icon: Bot },
        { id: 'videos', label: 'Videos', icon: Video },
        { id: 'backlogs', label: 'Requerimientos', icon: ClipboardList },
        // { id: 'conversations', label: 'Conversaciones', icon: MessageSquare },
    ] as const;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-16 animate-fadeIn">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-plataforma-gris-oscuro">Administración</h1>
                <p className="text-gray-600 mt-2">
                    Gestiona el catálogo de agentes, backlogs y supervisa las interacciones.
                </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="border-b border-gray-200">
                    <nav className="flex -mb-px px-6" aria-label="Tabs">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 py-4 px-6 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                                        ? 'border-plataforma-naranja text-plataforma-naranja'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                >
                                    <Icon size={18} />
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
