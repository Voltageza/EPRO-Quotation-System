import { useState, useEffect, useCallback } from 'react';
import {
  Stepper, Button, Group, Stack, Title, Card, TextInput, Select,
  NumberInput, Radio, Table, Badge, Alert, Text, Textarea, Loader, Divider,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft, IconArrowRight, IconCheck, IconAlertTriangle,
  IconAlertCircle, IconDownload, IconInfoCircle,
} from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getClients, createClient, createQuote, updateQuote, generateBom, getQuote,
  downloadQuotePdf,
} from '../../api/quotes.api';
import { getPanels } from '../../api/panels.api';
import { getInverterByClass, getMppts, getBatteries } from '../../api/components.api';

const formatPrice = (cents: number) => `R ${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

const SECTION_LABELS: Record<string, string> = {
  inverter: 'Inverter',
  solar_panels: 'Solar Panels',
  battery: 'Battery',
  dc_battery: 'DC Battery Cabling',
  pv_cabling: 'PV String Cabling',
  pv_dc_protection: 'PV DC Protection',
  ac_cabling: 'AC Cabling',
  ac_protection: 'AC Protection',
  mounting: 'Mounting & Hardware',
  labour: 'Labour & Installation',
  travel: 'Travel',
};

const SECTION_ORDER = ['inverter', 'solar_panels', 'battery', 'dc_battery', 'pv_cabling', 'pv_dc_protection', 'ac_cabling', 'ac_protection', 'mounting', 'labour', 'travel'];

interface Client { id: number; name: string; phone?: string; email?: string; address?: string }
interface Panel { id: number; name: string; power_w: number; voc: number; imp: number; status: string; product_id: number }
interface Battery { id: number; product_id: number; capacity_kwh: number; voltage: number; name?: string }
interface Mppt { id: number; product_id: number; max_pv_voltage: number; max_charge_a: number; model_code: string; name?: string }
interface BomItem {
  id: number; product_id: number; sku: string; product_name: string; unit: string;
  section: string; quantity: number; unit_price_cents: number; line_total_cents: number;
}
interface Flag { id?: number; code: string; severity: string; message: string; is_blocking: boolean | number }

export default function QuoteWizardPage() {
  const { id: paramId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const editMode = !!paramId;

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [quoteId, setQuoteId] = useState<number | null>(paramId ? parseInt(paramId, 10) : null);
  const [quoteNumber, setQuoteNumber] = useState('');

  // Step 1: Client
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [newClient, setNewClient] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', phone: '', email: '', address: '' });

  // Step 2: System Class
  const [systemClass, setSystemClass] = useState('V10');
  const [inverterInfo, setInverterInfo] = useState<any>(null);

  // Step 3: Components
  const [panels, setPanels] = useState<Panel[]>([]);
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [mppts, setMppts] = useState<Mppt[]>([]);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [panelQty, setPanelQty] = useState<number>(12);
  const [batteryId, setBatteryId] = useState<string | null>(null);
  const [batteryQty, setBatteryQty] = useState<number>(1);
  const [mpptId, setMpptId] = useState<string | null>(null);
  const [mpptQty, setMpptQty] = useState<number>(1);

  // Step 4: Installation
  const [dcBatteryDist, setDcBatteryDist] = useState<number>(1.5);
  const [acInvDbDist, setAcInvDbDist] = useState<number>(5);
  const [acDbGridDist, setAcDbGridDist] = useState<number>(10);
  const [pvStringLen, setPvStringLen] = useState<number>(20);
  const [travelDist, setTravelDist] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // Step 5: Review
  const [bomItems, setBomItems] = useState<BomItem[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [stringsCount, setStringsCount] = useState(0);
  const [panelsPerString, setPanelsPerString] = useState(0);

  // Load clients on mount
  useEffect(() => {
    getClients().then(setClients).catch(() =>
      notifications.show({ title: 'Error', message: 'Failed to load clients', color: 'red' })
    );
  }, []);

  // Load existing quote data in edit mode
  useEffect(() => {
    if (!editMode || !quoteId) return;
    setLoading(true);
    getQuote(quoteId).then(({ quote, bom_items, flags: f }: any) => {
      setQuoteNumber(quote.quote_number);
      setSelectedClientId(String(quote.client_id));
      setSystemClass(quote.system_class);
      if (quote.panel_id) setPanelId(String(quote.panel_id));
      if (quote.panel_qty) setPanelQty(quote.panel_qty);
      if (quote.battery_id) setBatteryId(String(quote.battery_id));
      if (quote.battery_qty) setBatteryQty(quote.battery_qty);
      if (quote.mppt_id) setMpptId(String(quote.mppt_id));
      if (quote.mppt_qty) setMpptQty(quote.mppt_qty);
      if (quote.dc_battery_distance_m != null) setDcBatteryDist(quote.dc_battery_distance_m);
      if (quote.ac_inverter_db_distance_m != null) setAcInvDbDist(quote.ac_inverter_db_distance_m);
      if (quote.ac_db_grid_distance_m != null) setAcDbGridDist(quote.ac_db_grid_distance_m);
      if (quote.pv_string_length_m != null) setPvStringLen(quote.pv_string_length_m);
      if (quote.travel_distance_km != null) setTravelDist(quote.travel_distance_km);
      if (quote.notes) setNotes(quote.notes);
      if (bom_items?.length) {
        setBomItems(bom_items);
        setFlags(f || []);
        setTotals({ subtotal_cents: quote.subtotal_cents, vat_cents: quote.vat_cents, total_cents: quote.total_cents });
        setStringsCount(quote.strings_count || 0);
        setPanelsPerString(quote.panels_per_string || 0);
      }
    }).catch(() =>
      notifications.show({ title: 'Error', message: 'Failed to load quote', color: 'red' })
    ).finally(() => setLoading(false));
  }, [editMode, quoteId]);

  // Load inverter info when system class changes
  const loadInverter = useCallback((sc: string) => {
    getInverterByClass(sc).then(setInverterInfo).catch(() => setInverterInfo(null));
  }, []);

  useEffect(() => { loadInverter(systemClass); }, [systemClass, loadInverter]);

  // Load components for step 3
  useEffect(() => {
    Promise.all([
      getPanels('approved'),
      getBatteries(),
      getMppts(),
    ]).then(([p, b, m]) => {
      setPanels(p);
      setBatteries(b);
      setMppts(m);
    }).catch(() =>
      notifications.show({ title: 'Error', message: 'Failed to load components', color: 'red' })
    );
  }, []);

  // Step handlers
  const handleStep1Next = async () => {
    let clientId: number;

    if (newClient) {
      if (!clientForm.name.trim()) {
        notifications.show({ title: 'Error', message: 'Client name is required', color: 'red' });
        return;
      }
      setLoading(true);
      try {
        const result = await createClient(clientForm);
        clientId = result.id;
        setSelectedClientId(String(clientId));
        setClients(prev => [...prev, { id: clientId, ...clientForm }]);
        setNewClient(false);
      } catch {
        notifications.show({ title: 'Error', message: 'Failed to create client', color: 'red' });
        setLoading(false);
        return;
      }
    } else {
      if (!selectedClientId) {
        notifications.show({ title: 'Error', message: 'Please select a client', color: 'red' });
        return;
      }
      clientId = parseInt(selectedClientId, 10);
    }

    if (!quoteId) {
      setLoading(true);
      try {
        const result = await createQuote({ client_id: clientId, system_class: systemClass });
        setQuoteId(result.id);
        setQuoteNumber(result.quote_number);
      } catch {
        notifications.show({ title: 'Error', message: 'Failed to create quote', color: 'red' });
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    setActiveStep(1);
  };

  const handleStep2Next = async () => {
    if (!quoteId) return;
    setLoading(true);
    try {
      await updateQuote(quoteId, { system_class: systemClass });
      setActiveStep(2);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to update system class', color: 'red' });
    }
    setLoading(false);
  };

  const handleStep3Next = async () => {
    if (!quoteId) return;
    if (!panelId || !batteryId || !mpptId) {
      notifications.show({ title: 'Error', message: 'Please select panel, battery, and MPPT', color: 'red' });
      return;
    }
    setLoading(true);
    try {
      await updateQuote(quoteId, {
        panel_id: parseInt(panelId, 10),
        panel_qty: panelQty,
        battery_id: parseInt(batteryId, 10),
        battery_qty: batteryQty,
        mppt_id: parseInt(mpptId, 10),
        mppt_qty: mpptQty,
      });
      setActiveStep(3);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to update components', color: 'red' });
    }
    setLoading(false);
  };

  const handleStep4Next = async () => {
    if (!quoteId) return;
    setLoading(true);
    try {
      await updateQuote(quoteId, {
        dc_battery_distance_m: dcBatteryDist,
        ac_inverter_db_distance_m: acInvDbDist,
        ac_db_grid_distance_m: acDbGridDist,
        pv_string_length_m: pvStringLen,
        travel_distance_km: travelDist,
        notes: notes || null,
      });

      const result = await generateBom(quoteId);
      setBomItems(result.bom_items);
      setFlags(result.flags);
      setTotals(result.totals);
      setStringsCount(result.strings_count);
      setPanelsPerString(result.panels_per_string);
      setActiveStep(4);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to generate BoM', color: 'red' });
    }
    setLoading(false);
  };

  const handleFinalize = async () => {
    if (!quoteId) return;
    setLoading(true);
    try {
      await updateQuote(quoteId, { status: 'review' });
      notifications.show({ title: 'Success', message: 'Quote finalized and sent for review', color: 'green' });
      navigate(`/quotes/${quoteId}`);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to finalize quote', color: 'red' });
    }
    setLoading(false);
  };

  const handleDownloadPdf = async () => {
    if (!quoteId) return;
    try {
      await downloadQuotePdf(quoteId);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to download PDF', color: 'red' });
    }
  };

  // Group BoM items by section
  const groupedBom: Record<string, BomItem[]> = {};
  for (const item of bomItems) {
    if (!groupedBom[item.section]) groupedBom[item.section] = [];
    groupedBom[item.section].push(item);
  }

  const blockingFlags = flags.filter(f => f.is_blocking);
  const selectedPanel = panels.find(p => String(p.id) === panelId);
  const selectedBattery = batteries.find(b => String(b.id) === batteryId);
  const selectedMppt = mppts.find(m => String(m.id) === mpptId);

  if (loading && editMode && !quoteNumber) {
    return <Group justify="center" p="xl"><Loader /></Group>;
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>{editMode ? `Edit ${quoteNumber}` : 'New Quote'}</Title>
        {quoteNumber && <Badge size="lg" variant="light">{quoteNumber}</Badge>}
      </Group>

      <Stepper active={activeStep} onStepClick={quoteId ? setActiveStep : undefined}>
        {/* ── Step 1: Client ── */}
        <Stepper.Step label="Client" description="Select or create">
          <Card shadow="sm" radius="md" withBorder p="lg" mt="md">
            <Stack>
              {!newClient ? (
                <>
                  <Select
                    label="Select Client"
                    placeholder="Search clients..."
                    searchable
                    data={clients.map(c => ({ value: String(c.id), label: c.name }))}
                    value={selectedClientId}
                    onChange={setSelectedClientId}
                  />
                  <Button variant="subtle" size="xs" onClick={() => setNewClient(true)}>
                    + Create new client
                  </Button>
                </>
              ) : (
                <>
                  <Text fw={600} size="sm">New Client</Text>
                  <TextInput
                    label="Name" required
                    value={clientForm.name}
                    onChange={e => setClientForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <Group grow>
                    <TextInput
                      label="Phone"
                      value={clientForm.phone}
                      onChange={e => setClientForm(prev => ({ ...prev, phone: e.target.value }))}
                    />
                    <TextInput
                      label="Email"
                      value={clientForm.email}
                      onChange={e => setClientForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </Group>
                  <TextInput
                    label="Address"
                    value={clientForm.address}
                    onChange={e => setClientForm(prev => ({ ...prev, address: e.target.value }))}
                  />
                  <Button variant="subtle" size="xs" onClick={() => setNewClient(false)}>
                    Back to client list
                  </Button>
                </>
              )}
            </Stack>
          </Card>

          <Group justify="flex-end" mt="md">
            <Button onClick={handleStep1Next} loading={loading} rightSection={<IconArrowRight size={16} />}>
              Next
            </Button>
          </Group>
        </Stepper.Step>

        {/* ── Step 2: System Class ── */}
        <Stepper.Step label="System" description="Choose size">
          <Card shadow="sm" radius="md" withBorder p="lg" mt="md">
            <Stack>
              <Radio.Group
                label="System Class"
                value={systemClass}
                onChange={setSystemClass}
              >
                <Stack mt="xs" gap="sm">
                  <Radio value="V5" label="V5 — 5 kVA" />
                  <Radio value="V8" label="V8 — 8 kVA" />
                  <Radio value="V10" label="V10 — 10 kVA" />
                  <Radio value="V15" label="V15 — 15 kVA" />
                </Stack>
              </Radio.Group>

              {inverterInfo && (
                <Alert icon={<IconInfoCircle size={16} />} color="blue" mt="sm">
                  <Text size="sm" fw={600}>{inverterInfo.name || 'Inverter'}</Text>
                  <Text size="sm">Rated: {(inverterInfo.rated_va / 1000).toFixed(1)} kVA | AC Output: {inverterInfo.ac_output_amps}A | Max DC: {inverterInfo.max_dc_voltage}V</Text>
                </Alert>
              )}
            </Stack>
          </Card>

          <Group justify="space-between" mt="md">
            <Button variant="default" onClick={() => setActiveStep(0)} leftSection={<IconArrowLeft size={16} />}>
              Back
            </Button>
            <Button onClick={handleStep2Next} loading={loading} rightSection={<IconArrowRight size={16} />}>
              Next
            </Button>
          </Group>
        </Stepper.Step>

        {/* ── Step 3: Components ── */}
        <Stepper.Step label="Components" description="Panel, battery, MPPT">
          <Card shadow="sm" radius="md" withBorder p="lg" mt="md">
            <Stack>
              <Text fw={600}>Solar Panel</Text>
              <Group grow align="flex-end">
                <Select
                  label="Panel"
                  placeholder="Select panel"
                  searchable
                  data={panels.map(p => ({ value: String(p.id), label: `${p.name} (${p.power_w}W)` }))}
                  value={panelId}
                  onChange={setPanelId}
                />
                <NumberInput label="Quantity" min={1} max={50} value={panelQty} onChange={v => setPanelQty(Number(v) || 1)} />
              </Group>
              {selectedPanel && (
                <Text size="xs" c="dimmed">
                  {selectedPanel.power_w}W | Voc: {selectedPanel.voc}V | Imp: {selectedPanel.imp}A
                </Text>
              )}

              <Divider my="xs" />
              <Text fw={600}>Battery</Text>
              <Group grow align="flex-end">
                <Select
                  label="Battery"
                  placeholder="Select battery"
                  searchable
                  data={batteries.map(b => ({ value: String(b.id), label: `${b.name || `Battery #${b.id}`} (${b.capacity_kwh}kWh, ${b.voltage}V)` }))}
                  value={batteryId}
                  onChange={setBatteryId}
                />
                <NumberInput label="Quantity" min={1} max={10} value={batteryQty} onChange={v => setBatteryQty(Number(v) || 1)} />
              </Group>
              {selectedBattery && (
                <Text size="xs" c="dimmed">
                  {selectedBattery.capacity_kwh}kWh | {selectedBattery.voltage}V
                </Text>
              )}

              <Divider my="xs" />
              <Text fw={600}>MPPT Controller</Text>
              <Group grow align="flex-end">
                <Select
                  label="MPPT"
                  placeholder="Select MPPT"
                  searchable
                  data={mppts.map(m => ({ value: String(m.id), label: `${m.name || m.model_code} (${m.max_charge_a}A)` }))}
                  value={mpptId}
                  onChange={setMpptId}
                />
                <NumberInput label="Quantity" min={1} max={5} value={mpptQty} onChange={v => setMpptQty(Number(v) || 1)} />
              </Group>
              {selectedMppt && (
                <Text size="xs" c="dimmed">
                  Max PV: {selectedMppt.max_pv_voltage}V | Charge: {selectedMppt.max_charge_a}A
                </Text>
              )}
            </Stack>
          </Card>

          <Group justify="space-between" mt="md">
            <Button variant="default" onClick={() => setActiveStep(1)} leftSection={<IconArrowLeft size={16} />}>
              Back
            </Button>
            <Button onClick={handleStep3Next} loading={loading} rightSection={<IconArrowRight size={16} />}>
              Next
            </Button>
          </Group>
        </Stepper.Step>

        {/* ── Step 4: Installation ── */}
        <Stepper.Step label="Installation" description="Distances & notes">
          <Card shadow="sm" radius="md" withBorder p="lg" mt="md">
            <Stack>
              <Text fw={600}>Cable Distances</Text>
              <Group grow>
                <NumberInput
                  label="DC battery distance (m)"
                  min={0} step={0.5} decimalScale={1}
                  value={dcBatteryDist}
                  onChange={v => setDcBatteryDist(Number(v) || 0)}
                />
                <NumberInput
                  label="AC inverter to DB (m)"
                  min={0} step={0.5} decimalScale={1}
                  value={acInvDbDist}
                  onChange={v => setAcInvDbDist(Number(v) || 0)}
                />
              </Group>
              <Group grow>
                <NumberInput
                  label="AC DB to grid (m)"
                  min={0} step={0.5} decimalScale={1}
                  value={acDbGridDist}
                  onChange={v => setAcDbGridDist(Number(v) || 0)}
                />
                <NumberInput
                  label="PV string length (m)"
                  min={0} step={1} decimalScale={1}
                  value={pvStringLen}
                  onChange={v => setPvStringLen(Number(v) || 0)}
                />
              </Group>
              <NumberInput
                label="Travel distance (km)"
                min={0} step={5}
                value={travelDist}
                onChange={v => setTravelDist(Number(v) || 0)}
                w="50%"
              />

              <Divider my="xs" />
              <Textarea
                label="Notes"
                placeholder="Any special instructions or site notes..."
                minRows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </Stack>
          </Card>

          <Group justify="space-between" mt="md">
            <Button variant="default" onClick={() => setActiveStep(2)} leftSection={<IconArrowLeft size={16} />}>
              Back
            </Button>
            <Button onClick={handleStep4Next} loading={loading} rightSection={<IconArrowRight size={16} />}>
              Generate BoM
            </Button>
          </Group>
        </Stepper.Step>

        {/* ── Step 5: Review ── */}
        <Stepper.Step label="Review" description="BoM & totals">
          <Stack mt="md">
            {/* Flags */}
            {flags.map((flag, i) => (
              <Alert
                key={i}
                color={flag.severity === 'error' ? 'red' : flag.severity === 'warning' ? 'yellow' : 'blue'}
                icon={flag.severity === 'error' ? <IconAlertCircle size={16} /> : <IconAlertTriangle size={16} />}
              >
                <Text size="sm">{flag.message}</Text>
              </Alert>
            ))}

            {/* String info */}
            {stringsCount > 0 && (
              <Alert icon={<IconInfoCircle size={16} />} color="blue">
                <Text size="sm">
                  String Configuration: {stringsCount} string{stringsCount !== 1 ? 's' : ''} of {panelsPerString} panels
                </Text>
              </Alert>
            )}

            {/* BoM table grouped by section */}
            {SECTION_ORDER.map(section => {
              const items = groupedBom[section];
              if (!items || items.length === 0) return null;
              return (
                <Card key={section} shadow="sm" radius="md" withBorder p={0}>
                  <Group bg="gray.1" px="md" py="xs">
                    <Text fw={600} size="sm">{SECTION_LABELS[section] || section}</Text>
                  </Group>
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>SKU</Table.Th>
                        <Table.Th>Description</Table.Th>
                        <Table.Th ta="center">Qty</Table.Th>
                        <Table.Th ta="right">Unit Price</Table.Th>
                        <Table.Th ta="right">Total</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {items.map((item) => (
                        <Table.Tr key={item.id}>
                          <Table.Td><Text size="xs">{item.sku}</Text></Table.Td>
                          <Table.Td><Text size="sm">{item.product_name}</Text></Table.Td>
                          <Table.Td ta="center">{item.quantity}</Table.Td>
                          <Table.Td ta="right"><Text size="sm">{formatPrice(item.unit_price_cents)}</Text></Table.Td>
                          <Table.Td ta="right"><Text size="sm" fw={500}>{formatPrice(item.line_total_cents)}</Text></Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Card>
              );
            })}

            {/* Totals */}
            {totals && (
              <Card shadow="sm" radius="md" withBorder p="lg">
                <Stack gap="xs" align="flex-end">
                  <Group gap="xl">
                    <Text size="sm">Subtotal:</Text>
                    <Text size="sm" fw={500}>{formatPrice(totals.subtotal_cents)}</Text>
                  </Group>
                  <Group gap="xl">
                    <Text size="sm">VAT (15%):</Text>
                    <Text size="sm" fw={500}>{formatPrice(totals.vat_cents)}</Text>
                  </Group>
                  <Divider w="200px" />
                  <Group gap="xl">
                    <Text size="lg" fw={700}>Total:</Text>
                    <Text size="lg" fw={700}>{formatPrice(totals.total_cents)}</Text>
                  </Group>
                </Stack>
              </Card>
            )}

            {/* Actions */}
            <Group justify="space-between" mt="md">
              <Button variant="default" onClick={() => setActiveStep(3)} leftSection={<IconArrowLeft size={16} />}>
                Back
              </Button>
              <Group>
                <Button
                  variant="outline"
                  onClick={handleDownloadPdf}
                  leftSection={<IconDownload size={16} />}
                >
                  Download PDF
                </Button>
                <Button
                  color="green"
                  onClick={handleFinalize}
                  loading={loading}
                  leftSection={<IconCheck size={16} />}
                  disabled={blockingFlags.length > 0}
                >
                  Finalize
                </Button>
              </Group>
            </Group>
          </Stack>
        </Stepper.Step>
      </Stepper>
    </Stack>
  );
}
