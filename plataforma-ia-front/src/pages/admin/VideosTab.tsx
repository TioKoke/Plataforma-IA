import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Save, Trash2, Video as VideoIcon, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import {
    createVideo,
    deleteVideo,
    fetchVideos,
    updateVideo,
} from '../../services/videosApi';
import type { Video, VideoCreate, VideoLevel } from '../../services/videosApi';

const LEVELS: VideoLevel[] = ['Básico', 'Intermedio', 'Avanzado'];

const LEVEL_BADGE: Record<VideoLevel, string> = {
    'Básico': 'bg-green-100 text-green-700',
    'Intermedio': 'bg-amber-100 text-amber-700',
    'Avanzado': 'bg-orange-100 text-orange-700',
};

function Thumbnail({ youtubeId, size = 'md' }: { youtubeId: string; size?: 'sm' | 'md' | 'lg' }) {
    const [failed, setFailed] = useState(false);
    const cls =
        size === 'lg' ? 'w-32 h-20' : size === 'md' ? 'w-20 h-12' : 'w-12 h-8';
    if (!youtubeId || failed) {
        return (
            <div className={`${cls} rounded bg-gray-100 flex items-center justify-center`}>
                <VideoIcon size={size === 'lg' ? 28 : 16} className="text-gray-400" />
            </div>
        );
    }
    return (
        <img
            src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
            onError={() => setFailed(true)}
            className={`${cls} rounded object-cover`}
            alt="thumbnail"
        />
    );
}

const VideosTab = () => {
    const { getIdToken } = useAuth();
    const { showAlert } = useAlert();
    const [videos, setVideos] = useState<Video[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVideo, setEditingVideo] = useState<Video | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchVideos();
            setVideos(data.videos);
            setCategories(data.categories);
        } catch (err) {
            console.error(err);
            showAlert('Error cargando videos', 'error');
        } finally {
            setLoading(false);
        }
    }, [showAlert]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleOpenModal = (video?: Video) => {
        setEditingVideo(video || null);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingVideo(null);
    };

    const handleDelete = async (videoId: string) => {
        const token = await getIdToken();
        if (!token) return;
        if (!window.confirm('¿Eliminar permanente este video?')) return;
        try {
            await deleteVideo(videoId, token);
            await loadData();
        } catch (err) {
            console.error(err);
            showAlert('Error al eliminar', 'error');
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <VideoIcon size={20} className="text-plataforma-naranja" />
                    Catálogo de Videos
                </h2>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-plataforma-naranja text-white font-medium rounded-lg hover:bg-orange-600 transition-colors"
                >
                    <Plus size={18} />
                    Nuevo Video
                </button>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Video</th>
                                <th className="px-6 py-4 font-semibold">Nivel</th>
                                <th className="px-6 py-4 font-semibold">Categoría</th>
                                <th className="px-6 py-4 font-semibold">Duración</th>
                                <th className="px-6 py-4 font-semibold">Canal</th>
                                <th className="px-6 py-4 font-semibold text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Cargando...</td></tr>
                            ) : videos.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No hay videos registrados</td></tr>
                            ) : (
                                videos.map((v) => (
                                    <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-3">
                                                <Thumbnail youtubeId={v.youtube_id} size="md" />
                                                <span className="font-medium text-gray-900 truncate max-w-md" title={v.title}>{v.title}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${LEVEL_BADGE[v.level]}`}>{v.level}</span>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium">{v.category}</span>
                                        </td>
                                        <td className="px-6 py-3 text-gray-600">{v.duration || <span className="text-gray-400">—</span>}</td>
                                        <td className="px-6 py-3 text-gray-600 truncate max-w-[180px]" title={v.company}>{v.company}</td>
                                        <td className="px-6 py-3 text-right">
                                            <button onClick={() => handleOpenModal(v)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors mr-2">
                                                <Pencil size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(v.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <VideoModal
                    video={editingVideo}
                    categories={categories}
                    onClose={closeModal}
                    onSuccess={() => { closeModal(); loadData(); }}
                    getIdToken={getIdToken}
                />
            )}
        </div>
    );
};

interface VideoModalProps {
    video: Video | null;
    categories: string[];
    onClose: () => void;
    onSuccess: () => void;
    getIdToken: () => Promise<string | null>;
}

const emptyForm: VideoCreate = {
    title: '',
    duration: '',
    level: 'Básico',
    category: '',
    youtube_id: '',
    description: '',
    company: '',
};

const VideoModal: React.FC<VideoModalProps> = ({ video, categories, onClose, onSuccess, getIdToken }) => {
    const { showAlert } = useAlert();
    const [formData, setFormData] = useState<VideoCreate>(
        video
            ? {
                title: video.title,
                duration: video.duration ?? '',
                level: video.level,
                category: video.category,
                youtube_id: video.youtube_id,
                description: video.description,
                company: video.company,
            }
            : emptyForm,
    );
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = await getIdToken();
        if (!token) {
            showAlert('Usuario no autenticado', 'error');
            return;
        }
        setLoading(true);
        try {
            // El backend autocompleta la duración si se manda vacía.
            const payload = { ...formData, duration: formData.duration?.trim() || null };
            if (video) {
                await updateVideo(video.id, payload, token);
            } else {
                await createVideo(payload as VideoCreate, token);
            }
            onSuccess();
        } catch (err) {
            console.error(err);
            showAlert('Error guardando video', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
                    <h3 className="text-xl font-bold">{video ? 'Editar Video' : 'Nuevo Video'}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <Thumbnail youtubeId={formData.youtube_id} size="lg" />
                        <div className="flex-1 text-sm text-gray-600">
                            <p className="font-medium text-gray-700 mb-1">Vista previa del thumbnail</p>
                            <p className="text-xs">Se genera automáticamente desde el ID de YouTube.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                            <input required name="title" value={formData.title} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-plataforma-naranja" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                YouTube ID <span className="text-xs font-normal text-gray-500">(ej. n-_PuCw2yeE)</span>
                            </label>
                            <input required name="youtube_id" value={formData.youtube_id} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-plataforma-naranja font-mono text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Duración <span className="text-xs font-normal text-gray-500">(opcional)</span>
                            </label>
                            <input
                                name="duration"
                                value={formData.duration ?? ''}
                                onChange={handleChange}
                                placeholder="Se autocompleta desde YouTube si la dejas vacía"
                                className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-plataforma-naranja"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nivel</label>
                            <select name="level" value={formData.level} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-plataforma-naranja">
                                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Categoría <span className="text-xs font-normal text-gray-500">(libre o elegir existente)</span>
                            </label>
                            <input
                                required
                                name="category"
                                value={formData.category}
                                onChange={handleChange}
                                list="video-categories"
                                className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-plataforma-naranja"
                            />
                            <datalist id="video-categories">
                                {categories.map(c => <option key={c} value={c} />)}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Canal / fuente</label>
                            <input required name="company" value={formData.company} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-plataforma-naranja" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                            <textarea required name="description" value={formData.description} onChange={handleChange} rows={3} className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-plataforma-naranja" />
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                        <button type="submit" disabled={loading} className="px-6 py-2 bg-plataforma-naranja text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2">
                            <Save size={16} />
                            {loading ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default VideosTab;
