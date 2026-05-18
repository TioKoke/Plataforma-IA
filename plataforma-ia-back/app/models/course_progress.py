"""
Modelos Pydantic para el progreso de cursos interactivos del usuario.
Espejo del shape usado por el frontend (useCourseProgress.ts).
"""
from pydantic import BaseModel, Field
from typing import Optional


class LessonProgress(BaseModel):
    completedStepIds: list[str] = Field(default_factory=list)
    completedAt: Optional[str] = None  # ISO 8601


class CourseProgressResponse(BaseModel):
    progress: dict[str, LessonProgress] = Field(default_factory=dict)
    updatedAt: Optional[str] = None


class CourseProgressUpdate(BaseModel):
    progress: dict[str, LessonProgress] = Field(default_factory=dict)
    updatedAt: str  # ISO 8601 del lado cliente — usado para last-write-wins
