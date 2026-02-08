import { useState, useEffect } from 'react';
import {
  Title, Card, Stack, Table, Text, Badge, Tabs, Group, Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { getInverters, getMppts, getBatteries } from '../../api/components.api';

interface Inverter {
  id: number; sku: string; name: string; system_class: string;
  rated_va: number; max_dc_voltage: number; ac_output_amps: number; retail_price: number;
}

interface Mppt {
  id: number; sku: string; name: string; model_code: string;
  max_pv_voltage: number; max_charge_a: number; max_pv_power_w: number; retail_price: number;
}

interface Battery {
  id: number; sku: string; name: string; capacity_kwh: number;
  voltage: number; chemistry: string; retail_price: number;
}

const formatPrice = (cents: number) => `R ${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

const classColor: Record<string, string> = { V5: 'blue', V8: 'teal', V10: 'orange', V15: 'red' };

export default function ComponentsPage() {
  const [inverters, setInverters] = useState<Inverter[]>([]);
  const [mppts, setMppts] = useState<Mppt[]>([]);
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getInverters(), getMppts(), getBatteries()])
      .then(([inv, mp, bat]) => {
        setInverters(inv); setMppts(mp); setBatteries(bat);
      })
      .catch(() => notifications.show({ title: 'Error', message: 'Failed to load components', color: 'red' }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Group justify="center" p="xl"><Loader /></Group>;

  return (
    <Stack>
      <Title order={2}>Victron Components</Title>

      <Tabs defaultValue="inverters">
        <Tabs.List>
          <Tabs.Tab value="inverters">Inverters ({inverters.length})</Tabs.Tab>
          <Tabs.Tab value="mppts">MPPTs ({mppts.length})</Tabs.Tab>
          <Tabs.Tab value="batteries">Batteries ({batteries.length})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="inverters" pt="md">
          <Card shadow="sm" radius="md" withBorder p={0}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>System Class</Table.Th>
                  <Table.Th>SKU</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th ta="right">Rated VA</Table.Th>
                  <Table.Th ta="right">DC Voltage</Table.Th>
                  <Table.Th ta="right">AC Output</Table.Th>
                  <Table.Th ta="right">Price</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {inverters.map((inv) => (
                  <Table.Tr key={inv.id}>
                    <Table.Td><Badge color={classColor[inv.system_class] || 'gray'}>{inv.system_class}</Badge></Table.Td>
                    <Table.Td><Text size="sm" fw={500}>{inv.sku}</Text></Table.Td>
                    <Table.Td>{inv.name}</Table.Td>
                    <Table.Td ta="right">{inv.rated_va.toLocaleString()} VA</Table.Td>
                    <Table.Td ta="right">{inv.max_dc_voltage} V</Table.Td>
                    <Table.Td ta="right">{inv.ac_output_amps} A</Table.Td>
                    <Table.Td ta="right">{formatPrice(inv.retail_price)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="mppts" pt="md">
          <Card shadow="sm" radius="md" withBorder p={0}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Model</Table.Th>
                  <Table.Th>SKU</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th ta="right">Max PV Voltage</Table.Th>
                  <Table.Th ta="right">Max Charge</Table.Th>
                  <Table.Th ta="right">Max PV Power</Table.Th>
                  <Table.Th ta="right">Price</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {mppts.map((m) => (
                  <Table.Tr key={m.id}>
                    <Table.Td><Badge variant="light">{m.model_code}</Badge></Table.Td>
                    <Table.Td><Text size="sm" fw={500}>{m.sku}</Text></Table.Td>
                    <Table.Td>{m.name}</Table.Td>
                    <Table.Td ta="right">{m.max_pv_voltage} V</Table.Td>
                    <Table.Td ta="right">{m.max_charge_a} A</Table.Td>
                    <Table.Td ta="right">{m.max_pv_power_w ? `${m.max_pv_power_w} W` : '—'}</Table.Td>
                    <Table.Td ta="right">{formatPrice(m.retail_price)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="batteries" pt="md">
          <Card shadow="sm" radius="md" withBorder p={0}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>SKU</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th ta="right">Capacity</Table.Th>
                  <Table.Th ta="right">Voltage</Table.Th>
                  <Table.Th>Chemistry</Table.Th>
                  <Table.Th ta="right">Price</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {batteries.map((b) => (
                  <Table.Tr key={b.id}>
                    <Table.Td><Text size="sm" fw={500}>{b.sku}</Text></Table.Td>
                    <Table.Td>{b.name}</Table.Td>
                    <Table.Td ta="right">{b.capacity_kwh} kWh</Table.Td>
                    <Table.Td ta="right">{b.voltage} V</Table.Td>
                    <Table.Td><Badge variant="light">{b.chemistry || '—'}</Badge></Table.Td>
                    <Table.Td ta="right">{formatPrice(b.retail_price)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
