import { useState, useCallback, useRef, useEffect } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  EdgeProps,
} from '@xyflow/react';
import { NumberInput, Text, Group, Popover, Badge, Stack } from '@mantine/core';
import { IconRuler2 } from '@tabler/icons-react';
import api from '../../../api/client';

const edgeTypeColors: Record<string, string> = {
  'pv-dc': '#e03131',
  'battery-dc': '#fd7e14',
  'mppt-dc': '#e8590c',
  'ac-power': '#1971c2',
  'ac-grid': '#2f9e44',
  'unknown': '#868e96',
};

interface VoltageDrop {
  dropV: number;
  dropPercent: number;
  acceptable: boolean;
  currentA: number;
  voltageV: number;
  gaugeMm2: number;
}

interface WiringEdgeData {
  wireType: string;
  distanceM: number;
  wireGauge: string;
  systemClass?: string;
  [key: string]: unknown;
}

export default function WiringEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const d = (data || {}) as WiringEdgeData;
  const wireType = d.wireType || 'unknown';
  const color = edgeTypeColors[wireType] || '#868e96';

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const [distance, setDistance] = useState<number>(d.distanceM || 5);
  const [wireGauge, setWireGauge] = useState<string>(d.wireGauge || '');
  const [voltageDrop, setVoltageDrop] = useState<VoltageDrop | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate wire spec when distance changes
  const calculateWire = useCallback(
    async (dist: number) => {
      if (!d.systemClass) return;

      try {
        const { data: result } = await api.post('/design/calculate-wire', {
          systemClass: d.systemClass,
          edgeType: wireType,
          distanceM: dist,
        });
        setWireGauge(result.wireGauge || '');
        setVoltageDrop(result.voltageDrop || null);
      } catch {
        // Silently fail — gauge label stays as is
      }
    },
    [d.systemClass, wireType]
  );

  // Debounced calculation
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      calculateWire(distance);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [distance, calculateWire]);

  // Voltage drop color: green ≤2.5%, orange 2.5-5%, red >5%
  const vDropColor = voltageDrop
    ? voltageDrop.dropPercent > 5 ? 'red' : voltageDrop.dropPercent > 2.5 ? 'orange' : 'green'
    : undefined;

  const vDropText = voltageDrop ? `${voltageDrop.dropPercent}%` : '';
  const label = wireGauge
    ? `${wireGauge} x ${distance}m${vDropText ? ` \u00B7 ${vDropText}` : ''}`
    : `${distance}m`;

  // Badge border color reflects voltage drop status
  const badgeColor = wireType === 'pv-dc' ? 'red' : wireType === 'battery-dc' ? 'orange' : wireType.startsWith('ac') ? 'blue' : 'gray';
  const borderStyle = voltageDrop && !voltageDrop.acceptable
    ? { border: `2px solid ${vDropColor === 'red' ? '#e03131' : '#fd7e14'}` }
    : {};

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: wireType === 'pv-dc' ? '5 3' : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -100%) translate(${labelX}px,${labelY - 10}px)`,
            pointerEvents: 'all',
          }}
        >
          <Popover opened={popoverOpen} onChange={setPopoverOpen} position="top" withArrow>
            <Popover.Target>
              <Badge
                size="sm"
                variant={selected ? 'filled' : 'light'}
                color={badgeColor}
                style={{ cursor: 'pointer', fontSize: 10, ...borderStyle }}
                onClick={() => setPopoverOpen(true)}
                leftSection={<IconRuler2 size={10} />}
              >
                {label}
              </Badge>
            </Popover.Target>
            <Popover.Dropdown>
              <Stack gap="xs">
                <Group gap="xs">
                  <NumberInput
                    label="Distance (m)"
                    value={distance}
                    onChange={(val) => setDistance(Number(val) || 0)}
                    min={0.5}
                    max={200}
                    step={0.5}
                    w={100}
                    size="xs"
                  />
                  {wireGauge && (
                    <div>
                      <Text size="xs" c="dimmed">Wire Gauge</Text>
                      <Text size="sm" fw={600}>{wireGauge}</Text>
                    </div>
                  )}
                </Group>
                {voltageDrop && (
                  <div>
                    <Text size="xs" c="dimmed">Voltage Drop</Text>
                    <Group gap={4}>
                      <Text size="sm" fw={600} c={vDropColor}>
                        {voltageDrop.dropV}V ({voltageDrop.dropPercent}%)
                      </Text>
                      <Text size="xs" c="dimmed">
                        at {voltageDrop.currentA}A / {voltageDrop.voltageV}V
                      </Text>
                    </Group>
                    {!voltageDrop.acceptable && (
                      <Text size="xs" c="red" fw={500}>
                        Exceeds 2.5% limit — increase gauge or reduce distance
                      </Text>
                    )}
                  </div>
                )}
              </Stack>
            </Popover.Dropdown>
          </Popover>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
