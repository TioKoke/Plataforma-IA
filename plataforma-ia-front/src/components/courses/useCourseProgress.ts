import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    fetchCourseProgress,
    putCourseProgress,
    type CourseProgressDTO,
} from '../../services/progressApi';

export interface LessonProgress {
    completedStepIds: string[];
    completedAt?: string; // ISO date when all steps done
}

export interface CourseProgress {
    [lessonId: string]: LessonProgress;
}

const STORAGE_KEY_PREFIX = 'plataforma-courses-progress';
const ANON_KEY = `${STORAGE_KEY_PREFIX}-anon`;
const DEBOUNCE_MS = 500;

function getStorageKey(userEmail: string | null): string {
    return `${STORAGE_KEY_PREFIX}-${userEmail ?? 'anon'}`;
}

function readLocal(key: string): CourseProgress {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function writeLocal(key: string, progress: CourseProgress): void {
    try {
        localStorage.setItem(key, JSON.stringify(progress));
    } catch {
        // localStorage lleno o no disponible — fail silencioso
    }
}

/**
 * Merge de dos CourseProgress.
 * Para cada lección: une completedStepIds; conserva el completedAt más antiguo
 * (primer momento real de completar). Si solo uno tiene completedAt, gana ese.
 */
function mergeProgress(a: CourseProgress, b: CourseProgress): CourseProgress {
    const result: CourseProgress = { ...a };
    for (const [lessonId, bLesson] of Object.entries(b)) {
        const aLesson = result[lessonId];
        if (!aLesson) {
            result[lessonId] = { ...bLesson };
            continue;
        }
        const mergedSteps = Array.from(
            new Set([...aLesson.completedStepIds, ...bLesson.completedStepIds]),
        );
        let completedAt = aLesson.completedAt ?? bLesson.completedAt;
        if (aLesson.completedAt && bLesson.completedAt) {
            completedAt = aLesson.completedAt < bLesson.completedAt
                ? aLesson.completedAt
                : bLesson.completedAt;
        }
        result[lessonId] = {
            completedStepIds: mergedSteps,
            ...(completedAt ? { completedAt } : {}),
        };
    }
    return result;
}

export function useCourseProgress() {
    const { userEmail, isLoading, getIdToken } = useAuth();
    const storageKey = getStorageKey(userEmail);

    const [progress, setProgress] = useState<CourseProgress>({});
    // hydrated evita grabar el estado inicial vacío antes de la primera lectura.
    const [hydrated, setHydrated] = useState(false);

    // Refs para evitar dependencias que recreen efectos
    const storageKeyRef = useRef(storageKey);
    useEffect(() => {
        storageKeyRef.current = storageKey;
    }, [storageKey]);

    // ── Hidratación: ejecuta cuando la clave de storage cambia (userEmail resuelto) ──
    useEffect(() => {
        if (isLoading) return; // espera a que MSAL termine

        let cancelled = false;
        const controller = new AbortController();

        const hydrate = async () => {
            // 1. Lee de la clave actual
            let local = readLocal(storageKey);

            // 2. Migra desde 'anon' si corresponde (solo para usuarios autenticados)
            if (userEmail && storageKey !== ANON_KEY) {
                const anonData = readLocal(ANON_KEY);
                if (Object.keys(anonData).length > 0) {
                    local = mergeProgress(local, anonData);
                    writeLocal(storageKey, local);
                    localStorage.removeItem(ANON_KEY);
                }
            }

            // 3. Backend es fuente de verdad: GET y merge
            if (userEmail) {
                try {
                    const token = await getIdToken();
                    if (token && !cancelled) {
                        const remote = await fetchCourseProgress(token, controller.signal);
                        if (!cancelled) {
                            local = mergeProgress(local, remote.progress as CourseProgress);
                            writeLocal(storageKey, local);
                        }
                    }
                } catch (err) {
                    // Backend caído o sin red: seguimos con lo local
                    if (!(err instanceof DOMException && err.name === 'AbortError')) {
                        console.warn('[useCourseProgress] fetch remoto falló, usando local:', err);
                    }
                }
            }

            if (!cancelled) {
                setProgress(local);
                setHydrated(true);
            }
        };

        hydrate();
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [storageKey, userEmail, isLoading, getIdToken]);

    // ── Persistencia: localStorage inmediato + PUT backend debounced ──
    const backendDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!hydrated || isLoading) return;
        writeLocal(storageKey, progress);

        if (!userEmail) return; // sin usuario autenticado: solo local

        if (backendDebounceRef.current) clearTimeout(backendDebounceRef.current);
        backendDebounceRef.current = setTimeout(async () => {
            try {
                const token = await getIdToken();
                if (!token) return;
                await putCourseProgress(
                    token,
                    progress as CourseProgressDTO,
                    new Date().toISOString(),
                );
            } catch (err) {
                console.warn('[useCourseProgress] PUT remoto falló:', err);
            }
        }, DEBOUNCE_MS);

        return () => {
            if (backendDebounceRef.current) clearTimeout(backendDebounceRef.current);
        };
    }, [progress, hydrated, isLoading, storageKey, userEmail, getIdToken]);

    // ── Sincronización cross-tab ──
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key !== storageKeyRef.current || !e.newValue) return;
            try {
                const next = JSON.parse(e.newValue) as CourseProgress;
                setProgress(next);
            } catch {
                // ignore
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    // ── Mutadores: solo mutan el state en memoria; la persistencia la maneja el efecto ──
    const markStepComplete = useCallback((lessonId: string, stepId: string) => {
        setProgress(prev => {
            const lesson = prev[lessonId] ?? { completedStepIds: [] };
            if (lesson.completedStepIds.includes(stepId)) return prev;
            return {
                ...prev,
                [lessonId]: {
                    ...lesson,
                    completedStepIds: [...lesson.completedStepIds, stepId],
                },
            };
        });
    }, []);

    const markLessonComplete = useCallback((lessonId: string) => {
        setProgress(prev => {
            const lesson = prev[lessonId] ?? { completedStepIds: [] };
            if (lesson.completedAt) return prev;
            return {
                ...prev,
                [lessonId]: {
                    ...lesson,
                    completedAt: new Date().toISOString(),
                },
            };
        });
    }, []);

    const resetLesson = useCallback((lessonId: string) => {
        setProgress(prev => {
            if (!(lessonId in prev)) return prev;
            const next = { ...prev };
            delete next[lessonId];
            return next;
        });
    }, []);

    const getLessonProgress = useCallback((lessonId: string): LessonProgress => {
        return progress[lessonId] ?? { completedStepIds: [] };
    }, [progress]);

    const isLessonComplete = useCallback((lessonId: string): boolean => {
        return !!progress[lessonId]?.completedAt;
    }, [progress]);

    const getLessonStepCount = useCallback((lessonId: string): number => {
        return progress[lessonId]?.completedStepIds.length ?? 0;
    }, [progress]);

    const resetAll = useCallback(() => {
        setProgress({});
    }, []);

    return {
        progress,
        markStepComplete,
        markLessonComplete,
        resetLesson,
        getLessonProgress,
        isLessonComplete,
        getLessonStepCount,
        resetAll,
    };
}
