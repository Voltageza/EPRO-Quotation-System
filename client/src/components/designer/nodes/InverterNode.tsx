import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, Text, Group, Badge } from '@mantine/core';
import { IconBolt } from '@tabler/icons-react';

export interface InverterData {
  label: string;
  brand: string;
  inverterId: number | null;
  inverterName: string;
  systemClass: string;
  ratedVa: number;
  hasMppt: boolean;
  hasBatteryPort: boolean;
  maxPvInputW: number | null;
}

const brandColors: Record<string, string> = {
  Victron: '#1c7ed6',
  Atess: '#e8590c',
};

function InverterNode({ data, selected }: NodeProps) {
  const d = data as unknown as InverterData;
  const brand = d.brand || 'Victron';
  const borderColor = selected ? brandColors[brand] || '#1c7ed6' : '#e9ecef';

  // Port visibility rules based on brand
  const showMpptIn = brand === 'Victron';       // External MPPT input
  const showPvIn = d.hasMppt;                    // Integrated MPPT (brands with built-in MPPT)
  const showBatteryIn = d.hasBatteryPort !== false; // Victron + Atess have battery

  return (
    <Card
      shadow={selected ? 'lg' : 'sm'}
      radius="md"
      withBorder
      p="xs"
      w={220}
      style={{
        borderColor,
        borderWidth: selected ? 2 : 1,
        background: '#f8f9ff',
      }}
    >
      <Group gap="xs" mb={4}>
        <IconBolt size={18} color={brandColors[brand] || '#1c7ed6'} />
        <Text size="xs" fw={700} c="dark">Inverter</Text>
        <Badge size="xs" color={brand === 'Atess' ? 'orange' : brand === 'Victron' ? 'blue' : 'gray'} variant="light">
          {brand}
        </Badge>
      </Group>

      {d.inverterName ? (
        <>
          <Text size="xs" c="dimmed" lineClamp={1}>{d.inverterName}</Text>
          <Group gap="xs" mt={4}>
            <Badge size="xs" color="blue" variant="light">
              {d.systemClass}
            </Badge>
            <Badge size="xs" color="gray" variant="light">
              {(d.ratedVa / 1000).toFixed(0)}kVA
            </Badge>
          </Group>
        </>
      ) : (
        <Text size="xs" c="dimmed" fs="italic">Select inverter model...</Text>
      )}

      {/* Left-side input handles */}
      {showBatteryIn && (
        <Handle
          type="target"
          position={Position.Left}
          id="dc-battery-in"
          style={{ background: '#fd7e14', width: 14, height: 14, top: '30%' }}
          title="Battery DC input"
        />
      )}

      {showPvIn && (
        <Handle
          type="target"
          position={Position.Left}
          id="dc-pv-in"
          style={{ background: '#e03131', width: 14, height: 14, top: '60%' }}
          title="PV DC input (integrated MPPT)"
        />
      )}

      {showMpptIn && (
        <Handle
          type="target"
          position={Position.Left}
          id="dc-mppt-in"
          style={{ background: '#e8590c', width: 14, height: 14, top: '60%' }}
          title="MPPT DC input"
        />
      )}

      {/* Right-side AC output */}
      <Handle
        type="source"
        position={Position.Right}
        id="ac-out"
        style={{ background: '#1971c2', width: 14, height: 14 }}
        title="AC output"
      />
    </Card>
  );
}

export default memo(InverterNode);
