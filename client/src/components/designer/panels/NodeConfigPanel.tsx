import { useState, useEffect } from 'react';
import { Node } from '@xyflow/react';
import {
  Stack, Text, Select, NumberInput, Card, Group, Badge, Divider, Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { getInverters, getMppts, getBatteries } from '../../../api/components.api';
import { BrandKey, BRAND_TOPOLOGIES } from '../utils/brandTopology';

interface NodeConfigPanelProps {
  selectedNode: Node | null;
  onUpdateNodeData: (nodeId: string, data: Record<string, any>) => void;
  panels: any[]; // Available panels from DB
  brand: BrandKey;
}

export default function NodeConfigPanel({ selectedNode, onUpdateNodeData, panels, brand }: NodeConfigPanelProps) {
  const [inverters, setInverters] = useState<any[]>([]);
  const [mppts, setMppts] = useState<any[]>([]);
  const [batteries, setBatteries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const topology = BRAND_TOPOLOGIES[brand];

  // Load component data filtered by brand
  useEffect(() => {
    setLoading(true);
    const promises: Promise<any>[] = [getInverters(brand)];

    if (!topology.integratedMppt) {
      promises.push(getMppts(brand));
    } else {
      promises.push(Promise.resolve([]));
    }

    if (topology.hasBattery) {
      promises.push(getBatteries(brand));
    } else {
      promises.push(Promise.resolve([]));
    }

    Promise.all(promises)
      .then(([inv, mp, bat]) => {
        setInverters(inv);
        setMppts(mp);
        setBatteries(bat);
      })
      .catch(() => notifications.show({ title: 'Error', message: 'Failed to load components', color: 'red' }))
      .finally(() => setLoading(false));
  }, [brand, topology.integratedMppt, topology.hasBattery]);

  if (!selectedNode) {
    return (
      <Stack gap="xs" p="xs">
        <Text size="sm" fw={700} c="dimmed" tt="uppercase">Configuration</Text>
        <Text size="xs" c="dimmed">Select a node on the canvas to configure it.</Text>
      </Stack>
    );
  }

  if (loading) {
    return (
      <Stack gap="xs" p="xs" align="center">
        <Loader size="sm" />
        <Text size="xs" c="dimmed">Loading components...</Text>
      </Stack>
    );
  }

  const nodeData = selectedNode.data as Record<string, any>;
  const updateData = (updates: Record<string, any>) => {
    onUpdateNodeData(selectedNode.id, { ...nodeData, ...updates });
  };

  return (
    <Stack gap="xs" p="xs" style={{ height: '100%', overflow: 'auto' }}>
      <Text size="sm" fw={700} c="dimmed" tt="uppercase">Configuration</Text>
      <Badge size="sm" variant="light">{selectedNode.type}</Badge>

      {selectedNode.type === 'solarPanelArray' && (
        <SolarPanelConfig data={nodeData} panels={panels} onUpdate={updateData} />
      )}
      {selectedNode.type === 'inverter' && (
        <InverterConfig data={nodeData} inverters={inverters} brand={brand} onUpdate={updateData} />
      )}
      {selectedNode.type === 'mppt' && (
        <MpptConfig data={nodeData} mppts={mppts} onUpdate={updateData} />
      )}
      {selectedNode.type === 'battery' && (
        <BatteryConfig data={nodeData} batteries={batteries} onUpdate={updateData} />
      )}
      {selectedNode.type === 'distributionBoard' && (
        <Text size="xs" c="dimmed">Distribution Board — no configuration needed.</Text>
      )}
      {selectedNode.type === 'gridConnection' && (
        <Text size="xs" c="dimmed">Grid Connection — no configuration needed.</Text>
      )}
    </Stack>
  );
}

// === Sub-config components ===

function SolarPanelConfig({ data, panels, onUpdate }: {
  data: Record<string, any>;
  panels: any[];
  onUpdate: (updates: Record<string, any>) => void;
}) {
  const panelOptions = panels.map((p: any) => ({
    value: String(p.id),
    label: `${p.name || p.sku} (${p.power_w}W)`,
  }));

  return (
    <Stack gap="xs">
      <Select
        label="Panel Model"
        placeholder="Select panel..."
        data={panelOptions}
        value={data.panelId ? String(data.panelId) : null}
        onChange={(val) => {
          if (!val) return;
          const panel = panels.find((p: any) => p.id === Number(val));
          if (panel) {
            onUpdate({
              panelId: panel.id,
              panelName: panel.name || panel.sku,
              panelPowerW: panel.power_w,
            });
          }
        }}
        searchable
      />
      <NumberInput
        label="Panel Quantity"
        value={data.quantity || 0}
        onChange={(val) => onUpdate({ quantity: Number(val) || 0 })}
        min={1}
        max={100}
      />
      {data.panelPowerW > 0 && (
        <Card p="xs" bg="gray.0" radius="sm">
          <Text size="xs">Total: <b>{((data.panelPowerW * (data.quantity || 0)) / 1000).toFixed(1)} kWp</b></Text>
        </Card>
      )}
    </Stack>
  );
}

function InverterConfig({ data, inverters, brand, onUpdate }: {
  data: Record<string, any>;
  inverters: any[];
  brand: BrandKey;
  onUpdate: (updates: Record<string, any>) => void;
}) {
  const inverterOptions = inverters.map((i: any) => ({
    value: String(i.id),
    label: `${i.name || i.sku} (${i.system_class} — ${(i.rated_va / 1000).toFixed(0)}kVA)`,
  }));

  return (
    <Stack gap="xs">
      <Badge size="sm" variant="filled" color={brand === 'Victron' ? 'blue' : 'gray'}>
        {brand}
      </Badge>
      <Select
        label="Model"
        placeholder="Select inverter..."
        data={inverterOptions}
        value={data.inverterId ? String(data.inverterId) : null}
        onChange={(val) => {
          if (!val) return;
          const inv = inverters.find((i: any) => i.id === Number(val));
          if (inv) {
            onUpdate({
              inverterId: inv.id,
              inverterName: inv.name || inv.sku,
              systemClass: inv.system_class,
              ratedVa: inv.rated_va,
              hasMppt: !!inv.has_mppt,
              hasBatteryPort: inv.has_battery_port !== 0,
              maxPvInputW: inv.max_pv_input_w || null,
              mpptCount: inv.mppt_count || 1,
              brand,
            });
          }
        }}
        searchable
      />

      {data.inverterId && (
        <>
          <Divider />
          <Card p="xs" bg="gray.0" radius="sm">
            <Stack gap={2}>
              <Text size="xs">System Class: <b>{data.systemClass}</b></Text>
              <Text size="xs">Rated Power: <b>{(data.ratedVa / 1000).toFixed(0)} kVA</b></Text>
              <Group gap="xs">
                {data.hasMppt && <Badge size="xs" color="orange">Integrated MPPT</Badge>}
                {data.hasBatteryPort && <Badge size="xs" color="yellow">Battery Port</Badge>}
                {!data.hasBatteryPort && <Badge size="xs" color="gray">Grid-Tie Only</Badge>}
              </Group>
              {data.maxPvInputW && (
                <Text size="xs">Max PV Input: <b>{(data.maxPvInputW / 1000).toFixed(1)} kW</b></Text>
              )}
            </Stack>
          </Card>
        </>
      )}
    </Stack>
  );
}

function MpptConfig({ data, mppts, onUpdate }: {
  data: Record<string, any>;
  mppts: any[];
  onUpdate: (updates: Record<string, any>) => void;
}) {
  const mpptOptions = mppts.map((m: any) => ({
    value: String(m.id),
    label: `${m.name || m.sku} (${m.model_code})`,
  }));

  return (
    <Stack gap="xs">
      <Select
        label="MPPT Model"
        placeholder="Select MPPT..."
        data={mpptOptions}
        value={data.mpptId ? String(data.mpptId) : null}
        onChange={(val) => {
          if (!val) return;
          const mppt = mppts.find((m: any) => m.id === Number(val));
          if (mppt) {
            onUpdate({
              mpptId: mppt.id,
              mpptName: mppt.name || mppt.sku,
              modelCode: mppt.model_code,
              maxPvPowerW: mppt.max_pv_power_w || null,
            });
          }
        }}
        searchable
      />
      <NumberInput
        label="Quantity"
        value={data.quantity || 1}
        onChange={(val) => onUpdate({ quantity: Number(val) || 1 })}
        min={1}
        max={10}
      />
      {data.maxPvPowerW && (
        <Card p="xs" bg="gray.0" radius="sm">
          <Text size="xs">Max PV Power: <b>{(data.maxPvPowerW / 1000).toFixed(1)} kW per unit</b></Text>
          <Text size="xs">Total Capacity: <b>{((data.maxPvPowerW * (data.quantity || 1)) / 1000).toFixed(1)} kW</b></Text>
        </Card>
      )}
    </Stack>
  );
}

function BatteryConfig({ data, batteries, onUpdate }: {
  data: Record<string, any>;
  batteries: any[];
  onUpdate: (updates: Record<string, any>) => void;
}) {
  const batteryOptions = batteries.map((b: any) => ({
    value: String(b.id),
    label: `${b.name || b.sku} (${b.capacity_kwh}kWh)`,
  }));

  return (
    <Stack gap="xs">
      <Select
        label="Battery Model"
        placeholder="Select battery..."
        data={batteryOptions}
        value={data.batteryId ? String(data.batteryId) : null}
        onChange={(val) => {
          if (!val) return;
          const bat = batteries.find((b: any) => b.id === Number(val));
          if (bat) {
            onUpdate({
              batteryId: bat.id,
              batteryName: bat.name || bat.sku,
              capacityKwh: bat.capacity_kwh,
              voltage: bat.voltage,
            });
          }
        }}
        searchable
      />
      <NumberInput
        label="Quantity"
        value={data.quantity || 1}
        onChange={(val) => onUpdate({ quantity: Number(val) || 1 })}
        min={1}
        max={20}
      />
      {data.capacityKwh > 0 && (
        <Card p="xs" bg="gray.0" radius="sm">
          <Text size="xs">Per Unit: <b>{data.capacityKwh} kWh @ {data.voltage}V</b></Text>
          <Text size="xs">Total Storage: <b>{(data.capacityKwh * (data.quantity || 1)).toFixed(1)} kWh</b></Text>
        </Card>
      )}
    </Stack>
  );
}
