import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, Text, Group } from '@mantine/core';
import { IconPlug } from '@tabler/icons-react';

export interface GridConnectionData {
  label: string;
}

function GridConnectionNode({ data, selected }: NodeProps) {
  const d = data as unknown as GridConnectionData;

  return (
    <Card
      shadow={selected ? 'lg' : 'sm'}
      radius="md"
      withBorder
      p="xs"
      w={170}
      style={{
        borderColor: selected ? '#2f9e44' : '#e9ecef',
        borderWidth: selected ? 2 : 1,
        background: '#f0fdf4',
      }}
    >
      <Group gap="xs">
        <IconPlug size={18} color="#2f9e44" />
        <Text size="xs" fw={700} c="dark">{d.label || 'Grid Connection'}</Text>
      </Group>

      {/* AC input from distribution board */}
      <Handle
        type="target"
        position={Position.Left}
        id="ac-in"
        style={{ background: '#2f9e44', width: 14, height: 14 }}
        title="AC input from DB"
      />
    </Card>
  );
}

export default memo(GridConnectionNode);
