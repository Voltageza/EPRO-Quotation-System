import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, Text, Group, Badge } from '@mantine/core';
import { IconBattery2 } from '@tabler/icons-react';

export interface BatteryNodeData {
  label: string;
  batteryId: number | null;
  batteryName: string;
  capacityKwh: number;
  voltage: number;
  quantity: number;
}

function BatteryNode({ data, selected }: NodeProps) {
  const d = data as unknown as BatteryNodeData;
  const totalKwh = (d.capacityKwh || 0) * (d.quantity || 0);

  return (
    <Card
      shadow={selected ? 'lg' : 'sm'}
      radius="md"
      withBorder
      p="xs"
      w={190}
      style={{
        borderColor: selected ? '#fd7e14' : '#e9ecef',
        borderWidth: selected ? 2 : 1,
        background: '#fff9f0',
      }}
    >
      <Group gap="xs" mb={4}>
        <IconBattery2 size={18} color="#fd7e14" />
        <Text size="xs" fw={700} c="dark">Battery</Text>
      </Group>

      {d.batteryName ? (
        <>
          <Text size="xs" c="dimmed" lineClamp={1}>{d.batteryName}</Text>
          <Group gap="xs" mt={4}>
            <Badge size="xs" color="orange" variant="light">
              {d.quantity}x {d.capacityKwh}kWh
            </Badge>
            <Badge size="xs" color="yellow" variant="light">
              {totalKwh.toFixed(1)}kWh total
            </Badge>
          </Group>
        </>
      ) : (
        <Text size="xs" c="dimmed" fs="italic">Select battery model...</Text>
      )}

      {/* DC output to inverter */}
      <Handle
        type="source"
        position={Position.Right}
        id="dc-out"
        style={{ background: '#fd7e14', width: 14, height: 14 }}
        title="DC output to inverter"
      />
    </Card>
  );
}

export default memo(BatteryNode);
