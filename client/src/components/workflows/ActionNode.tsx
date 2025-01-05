import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WorkflowActionType } from '@db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const WorkflowActionNode = memo(({ data, isConnectable }: any) => {
  return (
    <Card className="min-w-[250px] bg-background border-2 border-secondary">
      <CardHeader className="p-4">
        <CardTitle className="text-sm font-medium">Action</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <Select value={data.type} onValueChange={(value) => data.onChange?.({ type: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select action type" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(WorkflowActionType).map(([key, value]) => (
              <SelectItem key={key} value={value}>
                {key.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Handle
          type="target"
          position={Position.Left}
          isConnectable={isConnectable}
          className="w-3 h-3 bg-secondary"
        />
        <Handle
          type="source"
          position={Position.Right}
          isConnectable={isConnectable}
          className="w-3 h-3 bg-secondary"
        />
      </CardContent>
    </Card>
  );
});

ActionNode.displayName = 'ActionNode';
