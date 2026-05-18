const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export type VideoLevel = 'Básico' | 'Intermedio' | 'Avanzado';

export interface Video {
  id: string;
  title: string;
  duration?: string | null;
  level: VideoLevel;
  category: string;
  youtube_id: string;
  description: string;
  company: string;
  thumbnail: string;
}

export interface VideoListResponse {
  videos: Video[];
  total: number;
  categories: string[];
  levels: string[];
}

export interface VideoFilters {
  level?: string;
  category?: string;
  search?: string;
}

export type VideoCreate = Omit<Video, 'id' | 'thumbnail'>;
export type VideoUpdate = Partial<VideoCreate>;

export async function fetchVideos(filters?: VideoFilters): Promise<VideoListResponse> {
  const params = new URLSearchParams();
  if (filters?.level) params.set('level', filters.level);
  if (filters?.category) params.set('category', filters.category);
  if (filters?.search) params.set('search', filters.search);

  const query = params.toString();
  const url = `${API_URL}/videos/${query ? `?${query}` : ''}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function createVideo(video: VideoCreate, idToken: string): Promise<Video> {
  const res = await fetch(`${API_URL}/videos/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(video),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function updateVideo(
  videoId: string,
  updates: VideoUpdate,
  idToken: string,
): Promise<Video> {
  const res = await fetch(`${API_URL}/videos/${videoId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function deleteVideo(videoId: string, idToken: string): Promise<void> {
  const res = await fetch(`${API_URL}/videos/${videoId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
}
