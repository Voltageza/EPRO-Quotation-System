import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, Text, Group, Badge } from '@mantine/core';
import { IconSolarPanel } from '@tabler/icons-react';

export interface SolarPanelArrayData {
  label: string;
  panelId: number | null;
  panelName: string;
  panelPowerW: number;
  quantity: number;
}

function SolarPanelArrayNode({ data, selected }: NodeProps) {
  const d = data as unknown as SolarPanelArrayData;
  const totalKwp = ((d.panelPowerW || 0) * (d.quantity || 0)) / 1000;

  return (
    <Card
      shadow={selected ? 'lg' : 'sm'}
      radius="md"
      withBorder
      p="xs"
      w={200}
      style={{
        borderColor: selected ? '#fab005' : '#e9ecef',
        borderWidth: selected ? 2 : 1,
        background: '#fffdf0',
      }}
    >
      <Group gap="xs" mb={4}>
        <IconSolarPanel size={18} color="#fab005" />
        <Text size="xs" fw={700} c="dark">Solar Array</Text>
      </Group>

      {d.panelName ? (
        <>
          <Text size="xs" c="dimmed" lineClamp={1}>{d.panelName}</Text>
          <Group gap="xs" mt={4}>
            <Badge size="xs" color="yellow" variant="light">
              {d.quantity}x {d.panelPowerW}W
            </Badge>
            <Badge size="xs" color="orange" variant="light">
              {totalKwp.toFixed(1)} kWp
            </Badge>
          </Group>
        </>
      ) : (
        <Text size="xs" c="dimmed" fs="italic">Select panel model...</Text>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        id="dc-pv-out"
        style={{ background: '#e03131', width: 14, height: 14 }}
      />
    </Card>
  );
}

export default memo(SolarPanelArrayNode);
