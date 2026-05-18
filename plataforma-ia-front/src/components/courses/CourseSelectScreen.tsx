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

const LEVEL_BADGE: Record<string, string> = {
    'Básico': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    'Intermedio': 'bg-orange-100 text-orange-700 border border-orange-200',
    'Avanzado': 'bg-violet-100 text-violet-700 border border-violet-200',
};

const COURSE_THEME: Record<string, {
    iconBg: string;
    startBtn: string;
    expandedBorder: string;
    lessonIcon: string;
}> = {
    'course-1': {
        iconBg: 'bg-emerald-50 text-emerald-600',
        startBtn: 'bg-emerald-500 hover:bg-emerald-600 text-white',
        expandedBorder: 'border-emerald-200',
        lessonIcon: 'text-emerald-500',
    },
    'course-2': {
        iconBg: 'bg-orange-50 text-orange-500',
        startBtn: 'bg-orange-500 hover:bg-orange-600 text-white',
        expandedBorder: 'border-orange-200',
        lessonIcon: 'text-orange-500',
    },
    'course-3': {
        iconBg: 'bg-violet-50 text-violet-600',
        startBtn: 'bg-violet-600 hover:bg-violet-700 text-white',
        expandedBorder: 'border-violet-200',
        lessonIcon: 'text-violet-500',
    },
    'course-4': {
        iconBg: 'bg-fuchsia-50 text-fuchsia-600',
        startBtn: 'bg-fuchsia-600 hover:bg-fuchsia-700 text-white',
        expandedBorder: 'border-fuchsia-200',
        lessonIcon: 'text-fuchsia-500',
    },
};

function isCourseComplete(course: Course, progress: CourseProgress): boolean {
    return course.lessons.every(l => !!progress[l.id]?.completedAt);
}

function isCourseUnlocked(course: Course, progress: CourseProgress): boolean {
    if (!course.prerequisiteCourseIds || course.prerequisiteCourseIds.length === 0) return true;
    return course.prerequisiteCourseIds.every(prereqId => {
        const prereqCourse = courses.find(c => c.id === prereqId);
        if (!prereqCourse) return true;
        // Require at least one lesson completed from the prerequisite
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

    return (
        <div className="flex flex-col h-full w-full overflow-auto bg-transparent">
            {/* Header */}
            <div className="bg-transparent border-none px-8 py-8 shrink-0 relative z-10">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="w-12 h-12 rounded-2xl bg-white/80 backdrop-blur-sm border border-gray-200 shadow-sm text-plataforma-naranja flex items-center justify-center">
                            <Icons.GraduationCap size={24} />
                        </div>
                        <div>
                            <h1 className="text-plataforma-gris-oscuro font-heading font-bold text-3xl leading-tight">AgentFlow Cursos</h1>
                            <p className="text-gray-600 font-light text-sm mt-1">Aprende a construir sistemas de IA de forma interactiva y guiada</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 mt-4 text-sm text-gray-500 font-medium ml-1">
                        <span className="flex items-center gap-1.5">
                            <Icons.BookOpen size={15} className="text-plataforma-naranja" />
                            {courses.length} cursos disponibles
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Icons.ListChecks size={15} className="text-plataforma-amarillo" />
                            {courses.reduce((acc, c) => acc + c.lessons.reduce((a, l) => a + l.steps.length, 0), 0)} pasos en total
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Icons.Layers size={15} className="text-plataforma-naranja" />
                            3 niveles de dificultad
                        </span>
                    </div>
                </div>
            </div>

            {/* Course list */}
            <div className="flex-1 px-8 py-8">
                <div className="max-w-3xl mx-auto space-y-4">
                    {courses.map((course, courseIdx) => {
                        const theme = COURSE_THEME[course.id];
                        const Icon = (Icons as unknown as Record<string, LucideIcon>)[course.icon] || Icons.BookOpen;
                        const isOpen = expanded === course.id;
                        const totalSteps = course.lessons.reduce((acc, l) => acc + l.steps.length, 0);

                        const courseComplete = isCourseComplete(course, progress);
                        const completedLessons = course.lessons.filter(l => !!progress[l.id]?.completedAt).length;
                        const unlocked = isCourseUnlocked(course, progress);
                        const prereqNames = getPrerequisiteNames(course);

                        return (
                            <div
                                key={course.id}
                                className={`bg-white/80 backdrop-blur-md rounded-2xl border-2 transition-all duration-200 shadow-sm overflow-hidden ${
                                    !unlocked
                                        ? 'border-slate-200 opacity-60'
                                        : isOpen ? `border-plataforma-naranja/30` : 'border-white/50 hover:border-plataforma-naranja/20 hover:shadow-md hover:-translate-y-0.5'
                                }`}
                            >
                                {/* Course header — clickable to expand */}
                                <button
                                    onClick={() => unlocked && setExpanded(isOpen ? null : course.id)}
                                    className={`w-full flex items-center gap-5 px-6 py-5 text-left transition-colors ${
                                        unlocked ? 'hover:bg-slate-50/50 cursor-pointer' : 'cursor-not-allowed'
                                    }`}
                                >
                                    {/* Course number / completion */}
                                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                        courseComplete
                                            ? 'bg-emerald-100 text-emerald-600 border-2 border-emerald-300'
                                            : !unlocked
                                            ? 'bg-slate-100 text-slate-400 border-2 border-slate-200'
                                            : 'border-2 border-slate-200 text-slate-400'
                                    }`}>
                                        {courseComplete ? (
                                            <Icons.CheckCircle2 size={16} />
                                        ) : !unlocked ? (
                                            <Icons.Lock size={14} />
                                        ) : (
                                            courseIdx + 1
                                        )}
                                    </div>

                                    {/* Icon */}
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${theme.iconBg}`}>
                                        <Icon size={22} />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                                            <h2 className="text-slate-900 font-bold text-base">{course.title}</h2>
                                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${LEVEL_BADGE[course.level]}`}>
                                                {course.level}
                                            </span>
                                            {courseComplete && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                    Completado
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-slate-500 text-sm line-clamp-1 mb-1.5">{course.description}</p>
                                        <div className="flex items-center gap-4 text-xs text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <Icons.Clock size={11} />
                                                {course.estimatedMinutes} min
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Icons.BookOpen size={11} />
                                                {completedLessons}/{course.lessons.length} lección{course.lessons.length !== 1 ? 'es' : ''}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Icons.CheckSquare size={11} />
                                                {totalSteps} pasos
                                            </span>
                                        </div>

                                        {/* Lock message */}
                                        {!unlocked && prereqNames.length > 0 && (
                                            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-amber-600">
                                                <Icons.Lock size={10} className="shrink-0" />
                                                <span>Completa primero: {prereqNames.join(', ')}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Chevron */}
                                    {unlocked && (
                                        <Icons.ChevronDown
                                            size={18}
                                            className={`shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                        />
                                    )}
                                </button>

                                {/* Lessons (expanded) */}
                                {isOpen && unlocked && (
                                    <div className={`border-t ${theme.expandedBorder} px-6 pb-5`}>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-4 mb-3">
                                            Lecciones
                                        </p>
                                        <div className="space-y-3">
                                            {course.lessons.map((lesson, lessonIdx) => {
                                                const LessonIcon = (Icons as unknown as Record<string, LucideIcon>)[lesson.icon] || Icons.Layers;
                                                const lessonComplete = !!progress[lesson.id]?.completedAt;
                                                const lessonStepsDone = progress[lesson.id]?.completedStepIds.length ?? 0;
                                                const lessonTotalSteps = lesson.steps.length;
                                                const lessonInProgress = lessonStepsDone > 0 && !lessonComplete;

                                                return (
                                                    <div
                                                        key={lesson.id}
                                                        className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                                                            lessonComplete
                                                                ? 'bg-emerald-50/50 border-emerald-200'
                                                                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                                                        }`}
                                                    >
                                                        {/* Lesson number / check */}
                                                        <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                                            lessonComplete
                                                                ? 'bg-emerald-100 text-emerald-600 border border-emerald-300'
                                                                : 'bg-white border border-slate-200 text-slate-500'
                                                        }`}>
                                                            {lessonComplete ? (
                                                                <Icons.Check size={13} />
                                                            ) : (
                                                                lessonIdx + 1
                                                            )}
                                                        </div>

                                                        {/* Lesson icon */}
                                                        <div className={`w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 ${theme.lessonIcon}`}>
                                                            <LessonIcon size={16} />
                                                        </div>

                                                        {/* Lesson info */}
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="text-slate-800 font-semibold text-sm leading-tight">{lesson.title}</h3>
                                                            <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{lesson.description}</p>
                                                            <div className="flex items-center gap-3 mt-1">
                                                                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                                                                    <Icons.ListChecks size={10} />
                                                                    {lessonTotalSteps} pasos guiados
                                                                </span>
                                                                {lessonInProgress && (
                                                                    <span className="inline-flex items-center gap-1 text-[11px] text-plataforma-turquesa font-medium">
                                                                        <Icons.Clock size={10} />
                                                                        {lessonStepsDone}/{lessonTotalSteps} completados
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Start / Resume button */}
                                                        <button
                                                            onClick={() => onSelectLesson(course, lesson, lessonIdx)}
                                                            className={`shrink-0 text-sm font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                                                                lessonComplete
                                                                    ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-200'
                                                                    : theme.startBtn
                                                            }`}
                                                        >
                                                            {lessonComplete ? (
                                                                <><Icons.RotateCcw size={13} /> Repasar</>
                                                            ) : lessonInProgress ? (
                                                                <><Icons.Play size={13} fill="currentColor" /> Continuar</>
                                                            ) : (
                                                                <><Icons.Play size={13} fill="currentColor" /> Iniciar</>
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
        </div>
    );
};
