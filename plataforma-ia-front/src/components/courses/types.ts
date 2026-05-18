export type NodeType = 'agent' | 'llm' | 'tool' | 'data' | 'output';

export type NodeExecutionState = 'idle' | 'pending' | 'running' | 'done' | 'error';

export type BaseNodeData = Record<string, unknown> & {
    title: string;
    description: string;
    type: NodeType;
    icon: string;

    // LLM / Agent config
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;

    // Data / Input node
    userInput?: string;

    // Execution state (set by CourseWorkspace during flow execution)
    executionState?: NodeExecutionState;
    executionOutput?: string;
};

export type DraggedNodeData = BaseNodeData;

export interface ValidationDetail {
    label: string;
    done: boolean;
}

export interface ValidationResult {
    success: boolean;
    message: string;
    details?: ValidationDetail[];
}
