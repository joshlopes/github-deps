import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

interface NodeData {
    label: string;
    version: string;
    type: 'dependency' | 'project';
    active: boolean;
}

export const GraphNode = memo(({ data, selected }: NodeProps<NodeData>) => {
    return (
        <div className="relative">
            <Handle type="target" position={Position.Top} className="!bg-slate-300" />
            <div
                className={`px-4 py-2 shadow-lg rounded-lg border transition-all duration-200 ${
                    selected ? 'border-amber-400 shadow-amber-100 scale-110' : 'border-slate-200'
                } ${
                    data.type === 'dependency'
                        ? 'bg-emerald-500 text-white'
                        : data.active
                            ? 'bg-indigo-500 text-white'
                            : 'bg-slate-400 text-white'
                }`}
            >
                <div className="font-medium text-center">{data.label}</div>
                {data.version && (
                    <div className="text-xs opacity-80 text-center">v{data.version}</div>
                )}
            </div>
            <Handle type="source" position={Position.Bottom} className="!bg-slate-300" />
        </div>
    );
});

GraphNode.displayName = 'GraphNode';