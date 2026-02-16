import { Select, NumberInput, Stack, Text, Card } from '@mantine/core';

interface MountingSidePanelProps {
  mountingType: string;
  mountingRows: number;
  mountingCols: number;
  onChange: (updates: { mountingType?: string; mountingRows?: number; mountingCols?: number }) => void;
}

const MOUNTING_OPTIONS = [
  { value: 'ibr', label: 'IBR Sheet Roof' },
  { value: 'corrugated', label: 'Corrugated Sheet Roof' },
  { value: 'tile', label: 'Tile Roof' },
  { value: 'tilt_frame_ibr', label: 'Flat Roof - Tilt Frame (IBR)' },
  { value: 'tilt_frame_corrugated', label: 'Flat Roof - Tilt Frame (Corrugated)' },
];

export default function MountingSidePanel({ mountingType, mountingRows, mountingCols, onChange }: MountingSidePanelProps) {
  return (
    <Stack gap="xs">
      <Text size="sm" fw={700}>Mounting Configuration</Text>

      <Select
        label="Roof Type"
        data={MOUNTING_OPTIONS}
        value={mountingType}
        onChange={(val) => val && onChange({ mountingType: val })}
      />

      <NumberInput
        label="Rows"
        value={mountingRows}
        onChange={(val) => onChange({ mountingRows: Number(val) || 1 })}
        min={1}
        max={10}
      />

      <NumberInput
        label="Columns"
        value={mountingCols}
        onChange={(val) => onChange({ mountingCols: Number(val) || 1 })}
        min={1}
        max={20}
      />

      <Card p="xs" bg="gray.0" radius="sm">
        <Text size="xs" c="dimmed">
          Layout: {mountingRows} x {mountingCols} = {mountingRows * mountingCols} positions
        </Text>
      </Card>
    </Stack>
  );
}
