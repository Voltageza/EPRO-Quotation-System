import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, Text, Group, Badge } from '@mantine/core';
import { IconAdjustments } from '@tabler/icons-react';

export interface MpptNodeData {
  label: string;
  mpptId: number | null;
  mpptName: string;
  modelCode: string;
  quantity: number;
  maxPvPowerW: number | null;
}

function MpptNode({ data, selected }: NodeProps) {
  const d = data as unknown as MpptNodeData;

  return (
    <Card
      shadow={selected ? 'lg' : 'sm'}
      radius="md"
      withBorder
      p="xs"
      w={190}
      style={{
        borderColor: selected ? '#e8590c' : '#e9ecef',
        borderWidth: selected ? 2 : 1,
        background: '#fff5f0',
      }}
    >
      <Group gap="xs" mb={4}>
        <IconAdjustments size={18} color="#e8590c" />
        <Text size="xs" fw={700} c="dark">MPPT Controller</Text>
      </Group>

      {d.mpptName ? (
        <>
          <Text size="xs" c="dimmed" lineClamp={1}>{d.mpptName}</Text>
          <Group gap="xs" mt={4}>
            <Badge size="xs" color="orange" variant="light">{d.modelCode}</Badge>
            {d.quantity > 1 && (
              <Badge size="xs" color="gray" variant="light">{d.quantity}x</Badge>
            )}
          </Group>
        </>
      ) : (
        <Text size="xs" c="dimmed" fs="italic">Select MPPT model...</Text>
      )}

      {/* PV input from panel array */}
      <Handle
        type="target"
        position={Position.Left}
        id="pv-in"
        style={{ background: '#e03131', width: 14, height: 14 }}
        title="PV input"
      />

      {/* DC output to inverter */}
      <Handle
        type="source"
        position={Position.Right}
        id="dc-out"
        style={{ background: '#e8590c', width: 14, height: 14 }}
        title="DC output to inverter"
      />
    </Card>
  );
}

export default memo(MpptNode);
