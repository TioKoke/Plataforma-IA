import { useState } from 'react';
import * as Icons from 'lucide-react';
import { type LucideIcon } from 'lucide-react';
import { courses } from './courseData';
import type { Course, CourseLesson } from './courseData';
import type { CourseProgress } from './useCourseProgress';

interface Props {
    onSelectLesson: (course: Course, lesson: CourseLesson, lessonIndex: number) => void;
    progress?: CourseProgress;
}

/* Niveles — mapeo neutro alineado al design system */
const LEVEL_BADGE: Record<string, string> = {
    'Básico':     'bg-bg-inset text-ink-2 border border-border-soft',
    'Intermedio': 'bg-bg-inset text-ink-2 border border-border-soft',
    'Avanzado':   'bg-bg-inset text-ink-2 border border-border-soft',
};

function isCourseComplete(course: Course, progress: CourseProgress): boolean {
    return course.lessons.every(l => !!progress[l.id]?.completedAt);
}

function isCourseUnlocked(course: Course, progress: CourseProgress): boolean {
    if (!course.prerequisiteCourseIds || course.prerequisiteCourseIds.length === 0) return true;
    return course.prerequisiteCourseIds.every(prereqId => {
        const prereqCourse = courses.find(c => c.id === prereqId);
        if (!prereqCourse) return true;
        return prereqCourse.lessons.some(l => !!progress[l.id]?.completedAt);
    });
}

function getPrerequisiteNames(course: Course): string[] {
    if (!course.prerequisiteCourseIds) return [];
    return course.prerequisiteCourseIds
        .map(id => courses.find(c => c.id === id)?.title)
        .filter((t): t is string => !!t);
}

export const CourseSelectScreen = ({ onSelectLesson, progress = {} }: Props) => {
    const [expanded, setExpanded] = useState<string | null>(null);

    const totalSteps = courses.reduce(
        (acc, c) => acc + c.lessons.reduce((a, l) => a + l.steps.length, 0),
        0,
    );

    return (
        <div className="w-full">
            {/* Header — sin scroll propio, fluye con la página */}
            <div className="pb-6">
                <div className="flex items-start gap-4 mb-5">
                    <div
                        className="size-12 rounded-2xl grid place-items-center shrink-0"
                        style={{ background: 'var(--primary-soft)', color: 'var(--primary-ink)' }}
                    >
                        <Icons.GraduationCap size={22} />
                    </div>
                    <div>
                        <h2 className="ck-display text-[28px] leading-tight">AgentFlow Cursos</h2>
                        <p className="text-sm text-ink-muted mt-1.5">
                            Aprende a construir sistemas de IA de forma interactiva y guiada.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-5 text-[13px] text-ink-muted">
                    <span className="inline-flex items-center gap-1.5">
                        <Icons.BookOpen size={14} style={{ color: 'var(--primary-ck)' }} />
                        {courses.length} cursos disponibles
                    </span>
                    <span className="text-border-soft">·</span>
                    <span className="inline-flex items-center gap-1.5">
                        <Icons.ListChecks size={14} style={{ color: 'var(--primary-ck)' }} />
                        {totalSteps} pasos en total
                    </span>
                    <span className="text-border-soft">·</span>
                    <span className="inline-flex items-center gap-1.5">
                        <Icons.Layers size={14} style={{ color: 'var(--primary-ck)' }} />
                        3 niveles de dificultad
                    </span>
                </div>
            </div>

            {/* Course list */}
            <div className="space-y-3">
                {courses.map((course, courseIdx) => {
                    const Icon = (Icons as unknown as Record<string, LucideIcon>)[course.icon] || Icons.BookOpen;
                    const isOpen = expanded === course.id;
                    const courseTotalSteps = course.lessons.reduce((acc, l) => acc + l.steps.length, 0);

                    const courseComplete = isCourseComplete(course, progress);
                    const completedLessons = course.lessons.filter(l => !!progress[l.id]?.completedAt).length;
                    const unlocked = isCourseUnlocked(course, progress);
                    const prereqNames = getPrerequisiteNames(course);

                    return (
                        <div
                            key={course.id}
                            className={`ck-card overflow-hidden transition-all duration-150 ${
                                !unlocked
                                    ? 'opacity-60'
                                    : isOpen
                                    ? 'shadow-pop'
                                    : 'hover:-translate-y-0.5 hover:shadow-pop'
                            }`}
                            style={isOpen ? { borderColor: 'var(--primary-ck)' } : undefined}
                        >
                            {/* Course header */}
                            <button
                                onClick={() => unlocked && setExpanded(isOpen ? null : course.id)}
                                className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${
                                    unlocked ? 'hover:bg-bg-inset cursor-pointer' : 'cursor-not-allowed'
                                }`}
                            >
                                {/* Number / completion */}
                                <div
                                    className={`shrink-0 size-7 rounded-full grid place-items-center text-[12px] font-semibold border ${
                                        courseComplete
                                            ? 'border-transparent'
                                            : !unlocked
                                            ? 'bg-bg-inset border-border-soft text-ink-muted'
                                            : 'border-border-soft text-ink-muted-soft bg-bg-elev'
                                    }`}
                                    style={
                                        courseComplete
                                            ? { background: 'var(--primary-soft)', color: 'var(--primary-ink)' }
                                            : undefined
                                    }
                                >
                                    {courseComplete ? (
                                        <Icons.Check size={13} strokeWidth={3} />
                                    ) : !unlocked ? (
                                        <Icons.Lock size={12} />
                                    ) : (
                                        courseIdx + 1
                                    )}
                                </div>

                                {/* Icon */}
                                <div
                                    className="size-11 rounded-[10px] grid place-items-center shrink-0"
                                    style={{ background: 'var(--bg-inset)', color: 'var(--primary-ck)' }}
                                >
                                    <Icon size={20} />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <h3 className="text-ink font-semibold text-[15px]">{course.title}</h3>
                                        <span className={`ck-mono text-[10px] tracking-wider px-1.5 py-0.5 rounded ${LEVEL_BADGE[course.level]}`}>
                                            {course.level.toUpperCase()}
                                        </span>
                                        {courseComplete && (
                                            <span
                                                className="ck-mono text-[10px] tracking-wider px-1.5 py-0.5 rounded"
                                                style={{ background: 'var(--primary-soft)', color: 'var(--primary-ink)' }}
                                            >
                                                COMPLETADO
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-ink-muted text-[13px] line-clamp-1 mb-1.5">
                                        {course.description}
                                    </p>
                                    <div className="flex items-center gap-4 text-[11.5px] text-ink-muted-soft">
                                        <span className="inline-flex items-center gap-1">
                                            <Icons.Clock size={11} />
                                            {course.estimatedMinutes} min
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <Icons.BookOpen size={11} />
                                            {completedLessons}/{course.lessons.length} lección
                                            {course.lessons.length !== 1 ? 'es' : ''}
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <Icons.CheckSquare size={11} />
                                            {courseTotalSteps} pasos
                                        </span>
                                    </div>

                                    {!unlocked && prereqNames.length > 0 && (
                                        <div className="inline-flex items-center gap-1.5 mt-2 text-[11px] text-ink-muted">
                                            <Icons.Lock size={10} className="shrink-0" />
                                            <span>Completa primero: {prereqNames.join(', ')}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Chevron */}
                                {unlocked && (
                                    <Icons.ChevronDown
                                        size={18}
                                        className={`shrink-0 text-ink-muted-soft transition-transform duration-200 ${
                                            isOpen ? 'rotate-180' : ''
                                        }`}
                                    />
                                )}
                            </button>

                            {/* Lessons (expanded) */}
                            {isOpen && unlocked && (
                                <div className="border-t border-border-soft px-5 pb-4">
                                    <p className="ck-mono text-[10.5px] tracking-wider text-ink-muted-soft mt-4 mb-3">
                                        LECCIONES
                                    </p>
                                    <div className="space-y-2.5">
                                        {course.lessons.map((lesson, lessonIdx) => {
                                            const LessonIcon =
                                                (Icons as unknown as Record<string, LucideIcon>)[lesson.icon] ||
                                                Icons.Layers;
                                            const lessonComplete = !!progress[lesson.id]?.completedAt;
                                            const lessonStepsDone =
                                                progress[lesson.id]?.completedStepIds.length ?? 0;
                                            const lessonTotalSteps = lesson.steps.length;
                                            const lessonInProgress = lessonStepsDone > 0 && !lessonComplete;

                                            return (
                                                <div
                                                    key={lesson.id}
                                                    className="flex items-center gap-3.5 p-3.5 rounded-xl border border-border-soft bg-bg-elev hover:bg-bg-inset transition-colors"
                                                >
                                                    {/* Lesson number / check */}
                                                    <div
                                                        className={`shrink-0 size-7 rounded-full grid place-items-center text-[11px] font-semibold border ${
                                                            lessonComplete
                                                                ? 'border-transparent'
                                                                : 'bg-bg-elev border-border-soft text-ink-muted'
                                                        }`}
                                                        style={
                                                            lessonComplete
                                                                ? {
                                                                      background: 'var(--primary-soft)',
                                                                      color: 'var(--primary-ink)',
                                                                  }
                                                                : undefined
                                                        }
                                                    >
                                                        {lessonComplete ? (
                                                            <Icons.Check size={12} strokeWidth={3} />
                                                        ) : (
                                                            lessonIdx + 1
                                                        )}
                                                    </div>

                                                    <div className="size-9 rounded-lg bg-bg-elev border border-border-soft grid place-items-center shrink-0 text-ink-2">
                                                        <LessonIcon size={15} />
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-ink font-medium text-[13.5px] leading-tight">
                                                            {lesson.title}
                                                        </h4>
                                                        <p className="text-ink-muted text-[12px] mt-0.5 line-clamp-1">
                                                            {lesson.description}
                                                        </p>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted-soft">
                                                                <Icons.ListChecks size={10} />
                                                                {lessonTotalSteps} pasos guiados
                                                            </span>
                                                            {lessonInProgress && (
                                                                <span
                                                                    className="inline-flex items-center gap-1 text-[11px] font-medium"
                                                                    style={{ color: 'var(--primary-ck)' }}
                                                                >
                                                                    <Icons.Clock size={10} />
                                                                    {lessonStepsDone}/{lessonTotalSteps}{' '}
                                                                    completados
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={() => onSelectLesson(course, lesson, lessonIdx)}
                                                        className={`ck-btn ${
                                                            lessonComplete ? 'ck-btn-outline' : 'ck-btn-primary'
                                                        }`}
                                                    >
                                                        {lessonComplete ? (
                                                            <>
                                                                <Icons.RotateCcw size={13} /> Repasar
                                                            </>
                                                        ) : lessonInProgress ? (
                                                            <>
                                                                <Icons.Play size={13} fill="currentColor" />
                                                                Continuar
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Icons.Play size={13} fill="currentColor" />
                                                                Iniciar
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
