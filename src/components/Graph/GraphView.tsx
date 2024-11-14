import React, { useCallback, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useGithubStore } from '../../store/useGithubStore';

const CATEGORY_COLORS = {
  dependency: '#059669',
  project: '#2563eb',
  inactive: '#64748b'
};

interface GraphViewProps {
  selectedNode: string | null;
  onNodeSelect: (nodeId: string | null) => void;
}

export function GraphView({ selectedNode, onNodeSelect }: GraphViewProps) {
  const { graphData } = useGithubStore();
  const chartRef = useRef<ReactECharts>(null);

  const getGraphData = useCallback(() => {
    const nodes = graphData.nodes.map(node => ({
      id: node.id,
      name: node.name,
      value: node.version,
      category: node.color === '#059669' ? 'dependency' : node.color === '#2563eb' ? 'project' : 'inactive',
      symbolSize: 80,
      itemStyle: {
        opacity: selectedNode ? (node.id === selectedNode ? 1 : 0.3) : 1
      },
      label: {
        show: true,
        position: 'bottom',
        distance: 5,
        formatter: [
          `{title|${node.name}}`,
          `{small|v${node.version}}`
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
      { name: 'dependency', itemStyle: { color: CATEGORY_COLORS.dependency } },
      { name: 'project', itemStyle: { color: CATEGORY_COLORS.project } },
      { name: 'inactive', itemStyle: { color: CATEGORY_COLORS.inactive } }
    ];

    let filteredNodes = nodes;
    let filteredEdges = edges;

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
      series: [
        {
          type: 'graph',
          layout: 'force',
          force: {
            repulsion: 1200,
            gravity: 0.1,
            edgeLength: 250,
            layoutAnimation: true
          },
          data: filteredNodes,
          links: filteredEdges,
          categories,
          roam: true,
          draggable: true,
          label: {
            position: 'bottom',
            show: true
          },
          edgeLabel: {
            show: true,
            formatter: '{c}',
            fontSize: 12
          },
          scaleLimit: {
            min: 0.1,
            max: 2
          },
          lineStyle: {
            color: '#94a3b8',
            curveness: 0.1
          },
          emphasis: {
            focus: 'adjacency',
            lineStyle: {
              width: 4
            }
          }
        }
      ]
    };
  }, [getGraphData, selectedNode]);

  const handleChartEvents = {
    'dblclick': (params: any) => {
      if (params.dataType === 'node') {
        onNodeSelect(params.data.id === selectedNode ? null : params.data.id);
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
          Double-click node to focus
        </div>
      </div>
    </div>
  );
}