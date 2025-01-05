import { useCallback } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { WorkflowTriggerNode } from '@/components/workflows/TriggerNode';
import { WorkflowActionNode } from '@/components/workflows/ActionNode';

const nodeTypes = {
  triggerNode: WorkflowTriggerNode,
  actionNode: WorkflowActionNode,
};

export default function WorkflowsPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const addTriggerNode = () => {
    const newNode: Node = {
      id: `trigger-${Date.now()}`,
      type: 'triggerNode',
      position: { x: 100, y: 100 },
      data: { 
        label: 'New Trigger',
        type: 'QUOTE_CREATED',
        conditions: {}
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addActionNode = () => {
    const newNode: Node = {
      id: `action-${Date.now()}`,
      type: 'actionNode',
      position: { x: 400, y: 100 },
      data: { 
        label: 'New Action',
        type: 'SEND_EMAIL',
        config: {}
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Workflow Designer</h1>
        <div className="space-x-2">
          <Button onClick={addTriggerNode}>
            <Plus className="mr-2 h-4 w-4" />
            Add Trigger
          </Button>
          <Button onClick={addActionNode}>
            <Plus className="mr-2 h-4 w-4" />
            Add Action
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visual Workflow Editor</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ height: '70vh' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              fitView
            >
              <Controls />
              <MiniMap />
              <Background gap={12} size={1} />
            </ReactFlow>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
