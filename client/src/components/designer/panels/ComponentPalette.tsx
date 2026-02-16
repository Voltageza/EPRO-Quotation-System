import { Card, Text, Stack, Group, Divider, UnstyledButton, Badge } from '@mantine/core';
import {
  IconSolarPanel, IconBolt, IconAdjustments, IconBattery2,
  IconLayoutBoard, IconPlug,
} from '@tabler/icons-react';
import { DesignerNodeType } from '../nodes/nodeTypes';
import { BrandKey, BRAND_TOPOLOGIES } from '../utils/brandTopology';

interface PaletteItem {
  type: DesignerNodeType;
  label: string;
  icon: React.ReactNode;
  color: string;
  category: string;
}

const PALETTE_ITEMS: PaletteItem[] = [
  { type: 'solarPanelArray', label: 'Solar Panel Array', icon: <IconSolarPanel size={20} />, color: '#fab005', category: 'DC Components' },
  { type: 'mppt', label: 'MPPT Controller', icon: <IconAdjustments size={20} />, color: '#e8590c', category: 'DC Components' },
  { type: 'battery', label: 'Battery', icon: <IconBattery2 size={20} />, color: '#fd7e14', category: 'DC Components' },
  { type: 'inverter', label: 'Inverter', icon: <IconBolt size={20} />, color: '#1c7ed6', category: 'Conversion' },
  { type: 'distributionBoard', label: 'Distribution Board', icon: <IconLayoutBoard size={20} />, color: '#1971c2', category: 'AC Components' },
  { type: 'gridConnection', label: 'Grid Connection', icon: <IconPlug size={20} />, color: '#2f9e44', category: 'AC Components' },
];

interface ComponentPaletteProps {
  onDragStart: (nodeType: DesignerNodeType) => void;
  brand: BrandKey;
}

export default function ComponentPalette({ onDragStart, brand }: ComponentPaletteProps) {
  const topology = BRAND_TOPOLOGIES[brand];
  const filteredItems = PALETTE_ITEMS.filter((item) => topology.allowedNodeTypes.includes(item.type));
  const categories = [...new Set(filteredItems.map((item) => item.category))];

  return (
    <Stack gap="xs" p="xs" style={{ height: '100%', overflow: 'auto' }}>
      <Group gap="xs" justify="space-between">
        <Text size="sm" fw={700} c="dimmed" tt="uppercase">
          Components
        </Text>
        <Badge size="xs" variant="light">{brand}</Badge>
      </Group>

      {categories.map((category) => (
        <Stack key={category} gap={4}>
          <Text size="xs" c="dimmed" fw={600}>{category}</Text>
          {filteredItems.filter((item) => item.category === category).map((item) => (
            <UnstyledButton
              key={item.type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/reactflow', item.type);
                e.dataTransfer.effectAllowed = 'move';
                onDragStart(item.type);
              }}
            >
              <Card
                shadow="xs"
                radius="sm"
                withBorder
                p="xs"
                style={{
                  cursor: 'grab',
                  transition: 'box-shadow 0.15s',
                }}
                styles={{
                  root: {
                    '&:hover': {
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    },
                  },
                }}
              >
                <Group gap="xs">
                  <div style={{ color: item.color }}>{item.icon}</div>
                  <Text size="xs" fw={500}>{item.label}</Text>
                </Group>
              </Card>
            </UnstyledButton>
          ))}
          <Divider my={4} />
        </Stack>
      ))}

      <Text size="xs" c="dimmed" mt="xs">
        Drag components onto the canvas to build your system design.
      </Text>
    </Stack>
  );
}
