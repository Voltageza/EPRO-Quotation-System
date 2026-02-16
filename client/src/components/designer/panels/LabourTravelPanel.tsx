import { NumberInput, Stack, Text, Textarea } from '@mantine/core';

interface LabourTravelPanelProps {
  travelDistanceKm: number;
  pvStringLengthM: number;
  notes: string;
  onChange: (updates: { travelDistanceKm?: number; pvStringLengthM?: number; notes?: string }) => void;
}

export default function LabourTravelPanel({ travelDistanceKm, pvStringLengthM, notes, onChange }: LabourTravelPanelProps) {
  return (
    <Stack gap="xs">
      <Text size="sm" fw={700}>Labour & Travel</Text>

      <NumberInput
        label="Travel Distance (km one way)"
        value={travelDistanceKm}
        onChange={(val) => onChange({ travelDistanceKm: Number(val) || 0 })}
        min={0}
        max={500}
        step={5}
      />

      <NumberInput
        label="PV String Length (m)"
        description="Average cable run from panels to MPPT/inverter"
        value={pvStringLengthM}
        onChange={(val) => onChange({ pvStringLengthM: Number(val) || 10 })}
        min={5}
        max={100}
        step={5}
      />

      <Textarea
        label="Notes"
        placeholder="Additional notes for this quote..."
        value={notes}
        onChange={(e) => onChange({ notes: e.currentTarget.value })}
        autosize
        minRows={2}
        maxRows={4}
      />
    </Stack>
  );
}
