import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, Text, Group } from '@mantine/core';
import { IconLayoutBoard } from '@tabler/icons-react';

export interface DistributionBoardData {
  label: string;
}

function DistributionBoardNode({ data, selected }: NodeProps) {
  const d = data as unknown as DistributionBoardData;

  return (
    <Card
      shadow={selected ? 'lg' : 'sm'}
      radius="md"
      withBorder
      p="xs"
      w={180}
      style={{
        borderColor: selected ? '#1971c2' : '#e9ecef',
        borderWidth: selected ? 2 : 1,
        background: '#f0f4ff',
      }}
    >
      <Group gap="xs">
        <IconLayoutBoard size={18} color="#1971c2" />
        <Text size="xs" fw={700} c="dark">{d.label || 'Distribution Board'}</Text>
      </Group>

      {/* AC input from inverter */}
      <Handle
        type="target"
        position={Position.Left}
        id="ac-in"
        style={{ background: '#1971c2', width: 14, height: 14 }}
        title="AC input"
      />

      {/* AC output to grid */}
      <Handle
        type="source"
        position={Position.Right}
        id="ac-grid-out"
        style={{ background: '#2f9e44', width: 14, height: 14 }}
        title="AC output to grid"
      />
    </Card>
  );
}

export default memo(DistributionBoardNode);
