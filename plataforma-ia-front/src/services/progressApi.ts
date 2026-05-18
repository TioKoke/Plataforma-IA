const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface LessonProgressDTO {
    completedStepIds: string[];
    completedAt?: string | null;
}

export interface CourseProgressDTO {
    [lessonId: string]: LessonProgressDTO;
}

export interface CourseProgressResponse {
    progress: CourseProgressDTO;
    updatedAt: string | null;
}

export async function fetchCourseProgress(
    idToken: string,
    signal?: AbortSignal,
): Promise<CourseProgressResponse> {
    const res = await fetch(`${API_URL}/me/course-progress`, {
        headers: { Authorization: `Bearer ${idToken}` },
        signal,
    });
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
    return res.json();
}

export async function putCourseProgress(
    idToken: string,
    progress: CourseProgressDTO,
    updatedAt: string,
    signal?: AbortSignal,
): Promise<CourseProgressResponse> {
    const res = await fetch(`${API_URL}/me/course-progress`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ progress, updatedAt }),
        signal,
    });
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
    return res.json();
}
