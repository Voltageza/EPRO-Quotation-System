import { useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  addEdge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { notifications } from '@mantine/notifications';

import { nodeTypes } from './nodes/nodeTypes';
import { defaultNodeData, DesignerNodeType } from './nodes/nodeTypes';
import { edgeTypes } from './edges/edgeTypes';
import { getEdgeType } from './utils/connectionRules';
import { BrandKey, BRAND_TOPOLOGIES, createConnectionValidator, isNodeAllowedForBrand } from './utils/brandTopology';

interface DesignerCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange<Node>;
  onEdgesChange: OnEdgesChange<Edge>;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onNodeSelect: (node: Node | null) => void;
  brand: BrandKey;
}

let idCounter = 0;
const getNextId = () => `node_${Date.now()}_${idCounter++}`;

export default function DesignerCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  setNodes,
  setEdges,
  onNodeSelect,
  brand,
}: DesignerCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const validateConnection = useMemo(() => createConnectionValidator(brand), [brand]);
  const topology = BRAND_TOPOLOGIES[brand];

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!validateConnection(connection)) return;

      const wireType = getEdgeType(connection.sourceHandle, connection.targetHandle);

      // Find system class from inverter node in the graph
      const inverterNode = nodes.find((n: Node) => n.type === 'inverter' && (n.data as any).systemClass);
      const systemClass = inverterNode ? (inverterNode.data as any).systemClass : '';

      const newEdge: Edge = {
        id: `edge_${connection.source}_${connection.target}_${Date.now()}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: 'wiring',
        animated: true,
        data: {
          wireType,
          distanceM: 5,
          wireGauge: '',
          systemClass,
          calculatedItems: [],
        },
      };

      setEdges((eds: Edge[]) => addEdge(newEdge, eds));
    },
    [setEdges, nodes, validateConnection]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as DesignerNodeType;
      if (!type || !defaultNodeData[type]) return;

      // Guard: reject node types not allowed for this brand
      if (!isNodeAllowedForBrand(brand, type)) {
        notifications.show({
          title: 'Not Allowed',
          message: `${type} is not available for ${brand} topology`,
          color: 'red',
        });
        return;
      }

      const flowInstance = reactFlowInstance.current;
      if (!flowInstance) return;

      const position = flowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Build node data with brand-specific defaults
      const data = { ...defaultNodeData[type] };
      if (type === 'inverter') {
        data.brand = brand;
        data.hasMppt = topology.integratedMppt;
        data.hasBatteryPort = topology.hasBattery;
      }

      const newNode: Node = {
        id: getNextId(),
        type,
        position,
        data,
      };

      setNodes((nds: Node[]) => [...nds, newNode]);
    },
    [setNodes, brand, topology]
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeSelect(node);
    },
    [onNodeSelect]
  );

  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  return (
    <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onInit={(instance: ReactFlowInstance) => { reactFlowInstance.current = instance; }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        isValidConnection={validateConnection}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        deleteKeyCode={['Backspace', 'Delete']}
        style={{ background: '#fafafa' }}
      >
        <Background gap={15} size={1} color="#e0e0e0" />
        <Controls />
        <MiniMap
          nodeStrokeColor="#888"
          nodeColor={(node: Node) => {
            switch (node.type) {
              case 'solarPanelArray': return '#fab005';
              case 'inverter': return '#1c7ed6';
              case 'mppt': return '#e8590c';
              case 'battery': return '#fd7e14';
              case 'distributionBoard': return '#1971c2';
              case 'gridConnection': return '#2f9e44';
              default: return '#868e96';
            }
          }}
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
}
