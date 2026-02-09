import { useState, useEffect } from 'react';
import {
  Title, Card, Stack, Table, Text, Badge, Tabs, Group, Loader,
  Modal, Button, TextInput, NumberInput, Select,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import {
  getInverters, getMppts, getBatteries,
  createInverter, createMppt, createBattery,
} from '../../api/components.api';
import { getProducts } from '../../api/products.api';

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

interface Product {
  id: number; sku: string; name: string; category: string;
}

const formatPrice = (cents: number) => `R ${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

const classColor: Record<string, string> = { V5: 'blue', V8: 'teal', V10: 'orange', V15: 'red' };

export default function ComponentsPage() {
  const [inverters, setInverters] = useState<Inverter[]>([]);
  const [mppts, setMppts] = useState<Mppt[]>([]);
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalType, setModalType] = useState<'inverter' | 'mppt' | 'battery' | null>(null);

  // Inverter form
  const [invProductId, setInvProductId] = useState<string | null>(null);
  const [invSystemClass, setInvSystemClass] = useState<string | null>(null);
  const [invRatedVa, setInvRatedVa] = useState<number | string>(0);
  const [invMaxDcVoltage, setInvMaxDcVoltage] = useState<number | string>(0);
  const [invAcOutputAmps, setInvAcOutputAmps] = useState<number | string>(0);

  // MPPT form
  const [mpptProductId, setMpptProductId] = useState<string | null>(null);
  const [mpptModelCode, setMpptModelCode] = useState('');
  const [mpptMaxPvVoltage, setMpptMaxPvVoltage] = useState<number | string>(0);
  const [mpptMaxChargeA, setMpptMaxChargeA] = useState<number | string>(0);
  const [mpptMaxPvPowerW, setMpptMaxPvPowerW] = useState<number | string>(0);

  // Battery form
  const [batProductId, setBatProductId] = useState<string | null>(null);
  const [batCapacityKwh, setBatCapacityKwh] = useState<number | string>(0);
  const [batVoltage, setBatVoltage] = useState<number | string>(0);
  const [batChemistry, setBatChemistry] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [inv, mp, bat, prods] = await Promise.all([
        getInverters(), getMppts(), getBatteries(), getProducts(),
      ]);
      setInverters(inv); setMppts(mp); setBatteries(bat); setProducts(prods);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load components', color: 'red' });
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const productOptions = (category: string) =>
    products
      .filter((p) => p.category === category)
      .map((p) => ({ value: String(p.id), label: `${p.sku} — ${p.name}` }));

  const openInverterModal = () => {
    setInvProductId(null); setInvSystemClass(null);
    setInvRatedVa(0); setInvMaxDcVoltage(0); setInvAcOutputAmps(0);
    setModalType('inverter');
  };

  const openMpptModal = () => {
    setMpptProductId(null); setMpptModelCode('');
    setMpptMaxPvVoltage(0); setMpptMaxChargeA(0); setMpptMaxPvPowerW(0);
    setModalType('mppt');
  };

  const openBatteryModal = () => {
    setBatProductId(null); setBatCapacityKwh(0);
    setBatVoltage(0); setBatChemistry('');
    setModalType('battery');
  };

  const handleSaveInverter = async () => {
    if (!invProductId || !invSystemClass) {
      notifications.show({ title: 'Validation', message: 'Product and System Class are required', color: 'orange' });
      return;
    }
    try {
      await createInverter({
        product_id: Number(invProductId),
        system_class: invSystemClass,
        rated_va: Number(invRatedVa),
        max_dc_voltage: Number(invMaxDcVoltage),
        ac_output_amps: Number(invAcOutputAmps),
      });
      notifications.show({ title: 'Created', message: 'Inverter added', color: 'green' });
      setModalType(null);
      loadData();
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err.response?.data?.error || 'Failed to create inverter', color: 'red' });
    }
  };

  const handleSaveMppt = async () => {
    if (!mpptProductId || !mpptModelCode) {
      notifications.show({ title: 'Validation', message: 'Product and Model Code are required', color: 'orange' });
      return;
    }
    try {
      await createMppt({
        product_id: Number(mpptProductId),
        model_code: mpptModelCode,
        max_pv_voltage: Number(mpptMaxPvVoltage),
        max_charge_a: Number(mpptMaxChargeA),
        max_pv_power_w: Number(mpptMaxPvPowerW) || undefined,
      });
      notifications.show({ title: 'Created', message: 'MPPT added', color: 'green' });
      setModalType(null);
      loadData();
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err.response?.data?.error || 'Failed to create MPPT', color: 'red' });
    }
  };

  const handleSaveBattery = async () => {
    if (!batProductId) {
      notifications.show({ title: 'Validation', message: 'Product is required', color: 'orange' });
      return;
    }
    try {
      await createBattery({
        product_id: Number(batProductId),
        capacity_kwh: Number(batCapacityKwh),
        voltage: Number(batVoltage),
        chemistry: batChemistry || undefined,
      });
      notifications.show({ title: 'Created', message: 'Battery added', color: 'green' });
      setModalType(null);
      loadData();
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err.response?.data?.error || 'Failed to create battery', color: 'red' });
    }
  };

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
          <Group justify="flex-end" mb="sm">
            <Button leftSection={<IconPlus size={16} />} onClick={openInverterModal}>
              Add Inverter
            </Button>
          </Group>
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
          <Group justify="flex-end" mb="sm">
            <Button leftSection={<IconPlus size={16} />} onClick={openMpptModal}>
              Add MPPT
            </Button>
          </Group>
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
          <Group justify="flex-end" mb="sm">
            <Button leftSection={<IconPlus size={16} />} onClick={openBatteryModal}>
              Add Battery
            </Button>
          </Group>
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

      {/* Add Inverter Modal */}
      <Modal opened={modalType === 'inverter'} onClose={() => setModalType(null)} title="Add Inverter" size="md">
        <Stack>
          <Select
            label="Product"
            required
            placeholder="Select inverter product..."
            data={productOptions('inverter')}
            value={invProductId}
            onChange={setInvProductId}
            searchable
          />
          <Select
            label="System Class"
            required
            data={[
              { value: 'V5', label: 'V5' },
              { value: 'V8', label: 'V8' },
              { value: 'V10', label: 'V10' },
              { value: 'V15', label: 'V15' },
            ]}
            value={invSystemClass}
            onChange={setInvSystemClass}
          />
          <NumberInput label="Rated VA" required min={0} value={invRatedVa} onChange={setInvRatedVa} />
          <NumberInput label="Max DC Voltage (V)" required min={0} value={invMaxDcVoltage} onChange={setInvMaxDcVoltage} />
          <NumberInput label="AC Output Amps (A)" required min={0} value={invAcOutputAmps} onChange={setInvAcOutputAmps} />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setModalType(null)}>Cancel</Button>
            <Button onClick={handleSaveInverter}>Create</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Add MPPT Modal */}
      <Modal opened={modalType === 'mppt'} onClose={() => setModalType(null)} title="Add MPPT" size="md">
        <Stack>
          <Select
            label="Product"
            required
            placeholder="Select MPPT product..."
            data={productOptions('mppt')}
            value={mpptProductId}
            onChange={setMpptProductId}
            searchable
          />
          <TextInput label="Model Code" required placeholder="e.g. 150/35" value={mpptModelCode} onChange={(e) => setMpptModelCode(e.target.value)} />
          <NumberInput label="Max PV Voltage (V)" required min={0} value={mpptMaxPvVoltage} onChange={setMpptMaxPvVoltage} />
          <NumberInput label="Max Charge Current (A)" required min={0} value={mpptMaxChargeA} onChange={setMpptMaxChargeA} />
          <NumberInput label="Max PV Power (W)" min={0} value={mpptMaxPvPowerW} onChange={setMpptMaxPvPowerW} />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setModalType(null)}>Cancel</Button>
            <Button onClick={handleSaveMppt}>Create</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Add Battery Modal */}
      <Modal opened={modalType === 'battery'} onClose={() => setModalType(null)} title="Add Battery" size="md">
        <Stack>
          <Select
            label="Product"
            required
            placeholder="Select battery product..."
            data={productOptions('battery')}
            value={batProductId}
            onChange={setBatProductId}
            searchable
          />
          <NumberInput label="Capacity (kWh)" required min={0} decimalScale={2} value={batCapacityKwh} onChange={setBatCapacityKwh} />
          <NumberInput label="Voltage (V)" required min={0} value={batVoltage} onChange={setBatVoltage} />
          <TextInput label="Chemistry" placeholder="e.g. LiFePO4" value={batChemistry} onChange={(e) => setBatChemistry(e.target.value)} />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setModalType(null)}>Cancel</Button>
            <Button onClick={handleSaveBattery}>Create</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
