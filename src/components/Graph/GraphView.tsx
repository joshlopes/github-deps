import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption, GraphSeriesOption } from 'echarts/types/dist/shared';
import type { SeriesOption } from 'echarts';
import { useGithubStore } from '../../store/useGithubStore';
import { RepoModal } from './RepoModal';

const CATEGORY_COLORS = {
  monorepo: '#9333ea',    // Purple for monorepo services
  dependency: '#059669',  // Green for dependencies
  project: '#2563eb',     // Blue for standalone projects
  inactive: '#64748b'     // Gray for inactive nodes
};

interface GraphViewProps {
  selectedNode: string | null;
  onNodeSelect: (nodeId: string | null) => void;
}

interface ModalInfo {
  repoId: string;
  composerFiles: string[];
  latestTag?: string;
  repoUrl: string;
}

export function GraphView({ selectedNode, onNodeSelect }: GraphViewProps) {
  const { graphData, organization } = useGithubStore();
  const chartRef = useRef<ReactECharts>(null);
  const [modalInfo, setModalInfo] = useState<ModalInfo | null>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getGraphData = useCallback(() => {
    const nodes = graphData.nodes.map(node => ({
      id: node.id,
      name: node.name,
      value: node.version,
      category: node.color === '#059669'
        ? 'dependency'
        : node.color === '#9333ea'
          ? 'monorepo'
          : node.color === '#2563eb'
            ? 'project'
            : 'inactive',
      symbolSize: 80,
      itemStyle: {
        opacity: selectedNode ? (node.id === selectedNode ? 1 : 0.3) : 1
      },
      label: {
        show: true,
        position: 'bottom' as const,
        distance: 5,
        formatter: [
          `{title|${node.name}}`,
          node.isMonorepo
            ? `{monorepo|${node.monorepoName}}`
            : `{small|${node.version}}`
        ].join('\n'),
        rich: {
          title: {
            color: '#1e293b',
            fontSize: 14,
            fontWeight: 'bold',
            padding: [2, 0],
            width: 150,
            overflow: 'break'
          },
          small: {
            color: '#64748b',
            fontSize: 12,
            padding: [0, 0, 2, 0]
          },
          monorepo: {
            color: '#9333ea',
            fontSize: 12,
            fontStyle: 'italic',
            padding: [0, 0, 2, 0]
          }
        }
      }
    }));

    const edges = graphData.links.map(link => ({
      source: link.source,
      target: link.target,
      value: link.version,
      label: {
        show: true,
        formatter: link.version,
        fontSize: 12,
        color: '#64748b',
        backgroundColor: '#fff',
        padding: [4, 8],
        borderRadius: 4
      },
      lineStyle: {
        width: 1,
        curveness: 0.1,
        opacity: selectedNode
          ? (link.source === selectedNode || link.target === selectedNode ? 1 : 0.1)
          : 1
      }
    }));

    return { nodes, edges };
  }, [graphData, selectedNode]);

  const getOption = useCallback((): EChartsOption => {
    const { nodes, edges } = getGraphData();
    const categories = [
      { name: 'monorepo', itemStyle: { color: CATEGORY_COLORS.monorepo } },
      { name: 'dependency', itemStyle: { color: CATEGORY_COLORS.dependency } },
      { name: 'project', itemStyle: { color: CATEGORY_COLORS.project } },
      { name: 'inactive', itemStyle: { color: CATEGORY_COLORS.inactive } }
    ];

    // Default to showing all nodes and edges
    let filteredNodes = selectedNode ? [] : nodes;
    let filteredEdges = selectedNode ? [] : edges;

    if (selectedNode) {
      const connectedNodeIds = new Set(
        edges
          .filter(edge => edge.source === selectedNode || edge.target === selectedNode)
          .flatMap(edge => [edge.source, edge.target])
      );

      filteredNodes = nodes.filter(node =>
        connectedNodeIds.has(node.id) || node.id === selectedNode
      );

      filteredEdges = edges.filter(edge =>
        edge.source === selectedNode || edge.target === selectedNode
      );

      // Center on selected node
      const chart = chartRef.current?.getEchartsInstance();
      if (chart) {
        const selectedNodeData = filteredNodes.find(node => node.id === selectedNode);
        if (selectedNodeData) {
          chart.dispatchAction({
            type: 'focusNodeAdjacency',
            dataIndex: nodes.findIndex(node => node.id === selectedNode)
          });
        }
      }
    }

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          if (params.dataType === 'edge') {
            return `${params.data.source} → ${params.data.target}<br/>Version: ${params.data.value}`;
          }
          const node = graphData.nodes.find(n => n.id === params.data.id);
          if (node?.isMonorepo) {
            return `${node.name}<br/>Service in ${node.monorepoName}`;
          }
          return `${params.data.id}<br/>Version: ${params.data.value}`;
        }
      },
      legend: {
        data: categories.map(c => c.name),
        top: 20,
        textStyle: {
          color: '#64748b'
        }
      },
      animationDuration: 1500,
      animationEasingUpdate: 'quinticInOut',
      series: [{
        type: 'graph',
        layout: 'force',
        force: {
          repulsion: 1200,
          gravity: 0.1,
          edgeLength: 150,
          layoutAnimation: true
        },
        data: filteredNodes,
        links: filteredEdges,
        categories: [
          { name: 'dependency' },
          { name: 'monorepo' },
          { name: 'project' },
          { name: 'inactive' }
        ],
        roam: true,
        draggable: true,
        emphasis: {
          focus: 'adjacency',
          lineStyle: {
            width: 2
          }
        }
      }] as SeriesOption[]
    };
  }, [getGraphData, selectedNode, graphData.nodes]);

  const handleChartEvents = {
    'click': (params: any) => {
      if (params.dataType === 'node') {
        if (clickTimeoutRef.current) {
          // Double click detected
          clearTimeout(clickTimeoutRef.current);
          clickTimeoutRef.current = null;
          onNodeSelect(params.data.id === selectedNode ? null : params.data.id);
        } else {
          // Single click - show modal after a short delay
          clickTimeoutRef.current = setTimeout(() => {
            const [orgRepo] = params.data.id.split('>');
            const [, repo] = orgRepo.split('/');
            const node = graphData.nodes.find(n => n.id === params.data.id);

            setModalInfo({
              repoId: params.data.id,
              composerFiles: node?.composerFiles || [],
              latestTag: node?.version,
              repoUrl: `https://github.com/${organization}/${repo}`
            });
            clickTimeoutRef.current = null;
          }, 250);
        }
      } else if (!params.data) {
        onNodeSelect(null);
      }
    }
  };

  useEffect(() => {
    const chart = chartRef.current?.getEchartsInstance();
    if (chart) {
      chart.on('finished', () => {
        chart.hideLoading();
      });
    }

    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="w-full h-full">
      <ReactECharts
        ref={chartRef}
        option={getOption()}
        style={{ height: '100%' }}
        onEvents={handleChartEvents}
        opts={{ renderer: 'canvas' }}
      />
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-2">
        <div className="text-sm text-slate-600">
          Click for details, double-click to focus
        </div>
      </div>
      {modalInfo && (
        <RepoModal
          {...modalInfo}
          onClose={() => setModalInfo(null)}
        />
      )}
    </div>
  );
}