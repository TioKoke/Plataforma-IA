import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

export type AgentNodeData = {
  title: string;
  description: string;
  icon?: string;
  color?: string;
  category?: 'start' | 'process' | 'decision' | 'end';
};

type AgentNodeProps = {
  data: AgentNodeData;
  selected?: boolean;
};

const AgentNode = ({ data, selected }: AgentNodeProps) => {
  const getCategoryStyles = () => {
    switch (data.category) {
      case 'start':
        return 'bg-plataforma-gris-oscuro border-plataforma-gris-oscuro';
      case 'process':
        return 'bg-plataforma-turquesa border-plataforma-turquesa';
      case 'decision':
        return 'bg-plataforma-amarillo border-plataforma-amarillo text-plataforma-gris-oscuro';
      case 'end':
        return 'bg-plataforma-rojo border-plataforma-rojo';
      default:
        return data.color || 'bg-gray-500 border-gray-500';
    }
  };

  const isDecision = data.category === 'decision';

  return (
    <div
      className={`
        px-5 py-4 rounded-lg shadow-sm border-2 transition-all duration-200 min-w-[200px] max-w-[280px]
        ${getCategoryStyles()}
        ${selected ? 'ring-4 ring-plataforma-amarillo ring-opacity-60' : ''}
        ${isDecision ? '' : 'text-white'}
      `}
    >
      {/* Handles de conexión */}
      {data.category !== 'start' && (
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 bg-white border-2 border-current"
        />
      )}

      {/* Icono y Título */}
      <div className="flex items-center gap-3 mb-2">
        {data.icon && (
          <div className={`text-2xl p-2 rounded-lg ${isDecision ? 'bg-plataforma-gris-oscuro/10' : 'bg-white/20'}`}>
            {data.icon}
          </div>
        )}
        <h3 className="font-heading font-bold text-lg leading-tight">
          {data.title}
        </h3>
      </div>

      {/* Descripción */}
      <p className={`text-sm leading-relaxed ${isDecision ? 'text-plataforma-gris-oscuro/80' : 'text-white/90'}`}>
        {data.description}
      </p>

      {data.category !== 'end' && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 bg-white border-2 border-current"
        />
      )}
    </div>
  );
};

export default memo(AgentNode);
