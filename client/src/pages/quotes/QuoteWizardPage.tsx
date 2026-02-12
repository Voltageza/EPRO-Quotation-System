import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Stepper, Button, Group, Stack, Title, Card, TextInput, Select,
  NumberInput, Radio, Table, Badge, Alert, Text, Textarea, Loader,
  ThemeIcon, SimpleGrid, Skeleton,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useWindowEvent } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft, IconArrowRight, IconCheck, IconAlertTriangle,
  IconAlertCircle, IconDownload, IconInfoCircle, IconBulb,
  IconUser, IconBolt, IconSun, IconHome, IconReceipt,
} from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getClients, createClient, createQuote, updateQuote, generateBom, getQuote,
  downloadQuotePdf,
} from '../../api/quotes.api';
import { getPanels } from '../../api/panels.api';
import {
  getInverterByClass, getMppts, getBatteries, getRecommendedMppt,
  MpptRecommendation,
} from '../../api/components.api';

/* ─── Constants ─── */

const formatPrice = (cents: number) =>
  `R ${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

const SECTION_LABELS: Record<string, string> = {
  inverter: 'Inverter', solar_panels: 'Solar Panels', battery: 'Battery',
  dc_battery: 'DC Battery Cabling', pv_cabling: 'PV String Cabling',
  pv_dc_protection: 'PV DC Protection', ac_cabling: 'AC Cabling',
  ac_protection: 'AC Protection', mounting: 'Mounting & Hardware',
  labour: 'Labour & Installation', travel: 'Travel',
};

const SECTION_ORDER = [
  'inverter', 'solar_panels', 'battery', 'dc_battery', 'pv_cabling',
  'pv_dc_protection', 'ac_cabling', 'ac_protection', 'mounting', 'labour', 'travel',
];

const MOUNTING_LABELS: Record<string, string> = {
  ibr: 'IBR roof', corrugated: 'Corrugated roof', tile: 'Tile roof', tilt_frame: 'Tilt frame',
};

/* ─── Types ─── */

interface Client { id: number; name: string; phone?: string; email?: string; address?: string }
interface Panel { id: number; name: string; power_w: number; voc: number; imp: number; status: string; product_id: number }
interface Battery { id: number; product_id: number; capacity_kwh: number; voltage: number; name?: string }
interface Mppt { id: number; product_id: number; max_pv_voltage: number; max_charge_a: number; model_code: string; name?: string }
interface BomItem {
  id: number; product_id: number; sku: string; product_name: string; unit: string;
  section: string; quantity: number; unit_price_cents: number; line_total_cents: number;
}
interface Flag { id?: number; code: string; severity: string; message: string; is_blocking: boolean | number }

interface QuoteFormValues {
  selectedClientId: string;
  newClient: boolean;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientAddress: string;
  systemClass: string;
  panelId: string;
  panelQty: number;
  batteryId: string;
  batteryQty: number;
  mpptId: string;
  mpptQty: number;
  mountingType: string;
  tiltRoofType: string;
  mountingRows: number;
  mountingCols: number;
  dcBatteryDist: number;
  acInvDbDist: number;
  acDbGridDist: number;
  pvStringLen: number;
  travelDist: number;
  notes: string;
}

/* ─── Helpers ─── */

const extractError = (err: any, fallback: string): string => {
  const msg = err?.response?.data?.error;
  if (msg) return msg;
  const status = err?.response?.status;
  if (status === 401) return 'Session expired — please log in again';
  if (status === 404) return 'Resource not found';
  if (status === 400) return 'Invalid request — check your inputs';
  return fallback;
};

const flagToStep = (code: string): number | null => {
  if (/^(PANEL_|BATTERY_|MPPT_|STRING_|NO_PANEL|NO_BATTERY|NO_MPPT)/.test(code)) return 2;
  if (/^(MOUNTING_|DC_|AC_|PV_|TRAVEL_)/.test(code)) return 3;
  return null;
};

const STEP_FIELDS: Record<number, (keyof QuoteFormValues)[]> = {
  0: ['selectedClientId', 'clientName', 'clientEmail'],
  1: [],
  2: ['panelId', 'panelQty', 'batteryId', 'batteryQty', 'mpptId', 'mpptQty'],
  3: ['mountingRows', 'mountingCols'],
};

/* ─── Component ─── */

export default function QuoteWizardPage() {
  const { id: paramId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const editMode = !!paramId;

  // ── Mantine Form ──
  const form = useForm<QuoteFormValues>({
    mode: 'controlled',
    initialValues: {
      selectedClientId: '', newClient: false,
      clientName: '', clientPhone: '', clientEmail: '', clientAddress: '',
      systemClass: 'V10',
      panelId: '', panelQty: 12,
      batteryId: '', batteryQty: 1,
      mpptId: '', mpptQty: 1,
      mountingType: 'tile', tiltRoofType: 'ibr',
      mountingRows: 2, mountingCols: 6,
      dcBatteryDist: 1.5, acInvDbDist: 5, acDbGridDist: 10, pvStringLen: 20,
      travelDist: 0, notes: '',
    },
    validate: {
      selectedClientId: (v, vals) => (!vals.newClient && !v) ? 'Select a client' : null,
      clientName: (v, vals) => (vals.newClient && !v.trim()) ? 'Name is required' : null,
      clientEmail: (v, vals) => (vals.newClient && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) ? 'Invalid email format' : null,
      panelId: (v) => !v ? 'Select a panel' : null,
      panelQty: (v) => (typeof v !== 'number' || v < 1) ? 'At least 1 panel' : null,
      batteryId: (v) => !v ? 'Select a battery' : null,
      batteryQty: (v) => (typeof v !== 'number' || v < 1) ? 'At least 1 battery' : null,
      mpptId: (v) => !v ? 'Select an MPPT' : null,
      mpptQty: (v) => (typeof v !== 'number' || v < 1) ? 'At least 1 MPPT' : null,
      mountingRows: (v) => (typeof v !== 'number' || v < 1) ? 'At least 1 row' : null,
      mountingCols: (v) => (typeof v !== 'number' || v < 1) ? 'At least 1 column' : null,
    },
  });

  // ── Non-form state ──
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(editMode);
  const [editError, setEditError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [quoteId, setQuoteId] = useState<number | null>(paramId ? parseInt(paramId, 10) : null);
  const [quoteNumber, setQuoteNumber] = useState('');

  const [clients, setClients] = useState<Client[]>([]);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [mppts, setMppts] = useState<Mppt[]>([]);
  const [panelsLoading, setPanelsLoading] = useState(true);
  const [batteriesLoading, setBatteriesLoading] = useState(true);
  const [mpptsLoading, setMpptsLoading] = useState(true);

  const [inverterInfo, setInverterInfo] = useState<any>(null);
  const [recommendation, setRecommendation] = useState<MpptRecommendation | null>(null);
  const [isAutoSelected, setIsAutoSelected] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [bomItems, setBomItems] = useState<BomItem[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [stringsCount, setStringsCount] = useState(0);
  const [panelsPerString, setPanelsPerString] = useState(0);

  // ── Browser close warning when form is dirty ──
  useWindowEvent('beforeunload', (event: any) => {
    if (form.isDirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  // ── Load clients ──
  useEffect(() => {
    getClients().then(setClients).catch((err) =>
      notifications.show({ title: 'Error', message: extractError(err, 'Failed to load clients'), color: 'red' })
    );
  }, []);

  // ── Load components independently ──
  useEffect(() => {
    getPanels('approved')
      .then((p) => setPanels(p))
      .catch(() => notifications.show({ title: 'Error', message: 'Failed to load panels', color: 'red' }))
      .finally(() => setPanelsLoading(false));
    getBatteries()
      .then((b) => setBatteries(b))
      .catch(() => notifications.show({ title: 'Error', message: 'Failed to load batteries', color: 'red' }))
      .finally(() => setBatteriesLoading(false));
    getMppts()
      .then((m) => setMppts(m))
      .catch(() => notifications.show({ title: 'Error', message: 'Failed to load MPPTs', color: 'red' }))
      .finally(() => setMpptsLoading(false));
  }, []);

  // ── Load inverter info when system class changes ──
  useEffect(() => {
    getInverterByClass(form.values.systemClass)
      .then(setInverterInfo)
      .catch(() => setInverterInfo(null));
  }, [form.values.systemClass]);

  // ── Load existing quote in edit mode ──
  useEffect(() => {
    if (!editMode || !quoteId) return;
    setEditLoading(true);
    getQuote(quoteId)
      .then(({ quote, bom_items, flags: f }: any) => {
        const vals: Partial<QuoteFormValues> = {
          selectedClientId: String(quote.client_id),
          systemClass: quote.system_class,
          panelId: quote.panel_id ? String(quote.panel_id) : '',
          panelQty: quote.panel_qty || 12,
          batteryId: quote.battery_id ? String(quote.battery_id) : '',
          batteryQty: quote.battery_qty || 1,
          mpptId: quote.mppt_id ? String(quote.mppt_id) : '',
          mpptQty: quote.mppt_qty || 1,
          mountingType: quote.mounting_type?.startsWith('tilt_frame_') ? 'tilt_frame' : (quote.mounting_type || 'tile'),
          tiltRoofType: quote.mounting_type?.startsWith('tilt_frame_') ? quote.mounting_type.replace('tilt_frame_', '') : 'ibr',
          mountingRows: quote.mounting_rows || 2,
          mountingCols: quote.mounting_cols || 6,
          dcBatteryDist: quote.dc_battery_distance_m ?? 1.5,
          acInvDbDist: quote.ac_inverter_db_distance_m ?? 5,
          acDbGridDist: quote.ac_db_grid_distance_m ?? 10,
          pvStringLen: quote.pv_string_length_m ?? 20,
          travelDist: quote.travel_distance_km ?? 0,
          notes: quote.notes || '',
        };
        form.setValues(vals);
        form.resetDirty(vals as QuoteFormValues);
        setQuoteNumber(quote.quote_number);
        if (bom_items?.length) {
          setBomItems(bom_items);
          setFlags(f || []);
          setTotals({ subtotal_cents: quote.subtotal_cents, vat_cents: quote.vat_cents, total_cents: quote.total_cents });
          setStringsCount(quote.strings_count || 0);
          setPanelsPerString(quote.panels_per_string || 0);
        }
      })
      .catch((err) => setEditError(extractError(err, 'Failed to load quote')))
      .finally(() => setEditLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, quoteId]);

  // ── MPPT auto-suggestion (debounced) ──
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const pid = form.values.panelId;
    const pqty = form.values.panelQty;

    if (!pid || typeof pqty !== 'number' || pqty < 1) {
      setRecommendation(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      getRecommendedMppt(parseInt(pid, 10), pqty)
        .then((recs) => {
          if (recs.length > 0) {
            const top = recs[0];
            setRecommendation(top);
            form.setFieldValue('mpptId', String(top.mppt_id));
            form.setFieldValue('mpptQty', top.mppt_qty);
            setIsAutoSelected(true);
          } else {
            setRecommendation(null);
          }
        })
        .catch(() => setRecommendation(null));
    }, 500);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.panelId, form.values.panelQty]);

  // ── Step validation ──
  const validateStep = (step: number): boolean => {
    const fields = STEP_FIELDS[step] || [];
    let valid = true;
    for (const field of fields) {
      const result = form.validateField(field);
      if (result.hasError) valid = false;
    }
    return valid;
  };

  const handleStepClick = (step: number) => {
    if (!quoteId) return;
    if (step < activeStep) { setActiveStep(step); return; }
    for (let i = 0; i < step; i++) {
      if (!validateStep(i)) {
        setActiveStep(i);
        notifications.show({ title: 'Incomplete', message: `Please complete step ${i + 1} first`, color: 'orange' });
        return;
      }
    }
    setActiveStep(step);
  };

  // ── Dynamic step descriptions ──
  const stepDescs = useMemo(() => {
    const client = !form.values.newClient
      ? clients.find(c => String(c.id) === form.values.selectedClientId)
      : null;
    const panel = panels.find(p => String(p.id) === form.values.panelId);
    return [
      client?.name || (form.values.newClient && form.values.clientName) || 'Select or create',
      `${form.values.systemClass} System`,
      panel ? `${form.values.panelQty}× ${panel.power_w}W` : 'Panel, battery, MPPT',
      `${MOUNTING_LABELS[form.values.mountingType] || form.values.mountingType} ${form.values.mountingRows}×${form.values.mountingCols}`,
      totals ? formatPrice(totals.total_cents) : 'BoM & totals',
    ];
  }, [form.values, clients, panels, totals]);

  // ── Step handlers ──
  const handleStep1Next = async () => {
    if (!validateStep(0)) return;
    let clientId: number;

    if (form.values.newClient) {
      setLoading(true);
      try {
        const result = await createClient({
          name: form.values.clientName, phone: form.values.clientPhone,
          email: form.values.clientEmail, address: form.values.clientAddress,
        });
        clientId = result.id;
        form.setFieldValue('selectedClientId', String(clientId));
        form.setFieldValue('newClient', false);
        setClients(prev => [...prev, { id: clientId, name: form.values.clientName, phone: form.values.clientPhone, email: form.values.clientEmail, address: form.values.clientAddress }]);
      } catch (err: any) {
        notifications.show({ title: 'Error', message: extractError(err, 'Failed to create client'), color: 'red' });
        setLoading(false);
        return;
      }
    } else {
      clientId = parseInt(form.values.selectedClientId, 10);
    }

    if (!quoteId) {
      setLoading(true);
      try {
        const result = await createQuote({ client_id: clientId, system_class: form.values.systemClass });
        setQuoteId(result.id);
        setQuoteNumber(result.quote_number);
      } catch (err: any) {
        notifications.show({ title: 'Error', message: extractError(err, 'Failed to create quote'), color: 'red' });
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
      await updateQuote(quoteId, { system_class: form.values.systemClass });
      setActiveStep(2);
    } catch (err: any) {
      notifications.show({ title: 'Error', message: extractError(err, 'Failed to update system class'), color: 'red' });
    }
    setLoading(false);
  };

  const handleStep3Next = async () => {
    if (!quoteId) return;
    if (!validateStep(2)) return;
    setLoading(true);
    try {
      await updateQuote(quoteId, {
        panel_id: parseInt(form.values.panelId, 10),
        panel_qty: Number(form.values.panelQty) || 1,
        battery_id: parseInt(form.values.batteryId, 10),
        battery_qty: Number(form.values.batteryQty) || 1,
        mppt_id: parseInt(form.values.mpptId, 10),
        mppt_qty: Number(form.values.mpptQty) || 1,
      });
      setActiveStep(3);
    } catch (err: any) {
      notifications.show({ title: 'Error', message: extractError(err, 'Failed to update components'), color: 'red' });
    }
    setLoading(false);
  };

  const handleStep4Next = async () => {
    if (!quoteId) return;
    if (!validateStep(3)) return;
    setLoading(true);

    // Save installation details
    try {
      await updateQuote(quoteId, {
        mounting_type: form.values.mountingType === 'tilt_frame'
          ? `tilt_frame_${form.values.tiltRoofType}` : form.values.mountingType,
        mounting_rows: Number(form.values.mountingRows) || 1,
        mounting_cols: Number(form.values.mountingCols) || 1,
        dc_battery_distance_m: Number(form.values.dcBatteryDist) || 0,
        ac_inverter_db_distance_m: Number(form.values.acInvDbDist) || 0,
        ac_db_grid_distance_m: Number(form.values.acDbGridDist) || 0,
        pv_string_length_m: Number(form.values.pvStringLen) || 0,
        travel_distance_km: Number(form.values.travelDist) || 0,
        notes: form.values.notes || null,
      });
    } catch (err: any) {
      notifications.show({ title: 'Error', message: extractError(err, 'Failed to save installation details'), color: 'red' });
      setLoading(false);
      return;
    }

    // Generate BoM (separate try/catch — don't advance if this fails)
    try {
      const result = await generateBom(quoteId);
      setBomItems(result.bom_items);
      setFlags(result.flags);
      setTotals(result.totals);
      setStringsCount(result.strings_count);
      setPanelsPerString(result.panels_per_string);
      setActiveStep(4);
    } catch (err: any) {
      setBomItems([]);
      setFlags([]);
      setTotals(null);
      notifications.show({
        title: 'BoM Generation Failed',
        message: extractError(err, 'Failed to generate Bill of Materials. Check your component selections.'),
        color: 'red', autoClose: 8000,
      });
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
    } catch (err: any) {
      notifications.show({ title: 'Error', message: extractError(err, 'Failed to finalize quote'), color: 'red' });
    }
    setLoading(false);
  };

  const handleDownloadPdf = async () => {
    if (!quoteId) return;
    setPdfLoading(true);
    try {
      await downloadQuotePdf(quoteId);
    } catch (err: any) {
      notifications.show({ title: 'Error', message: extractError(err, 'Failed to download PDF'), color: 'red' });
    }
    setPdfLoading(false);
  };

  // ── Computed values ──
  const groupedBom = useMemo(() => {
    const g: Record<string, BomItem[]> = {};
    for (const item of bomItems) {
      if (!g[item.section]) g[item.section] = [];
      g[item.section].push(item);
    }
    return g;
  }, [bomItems]);

  const blockingFlags = useMemo(() => flags.filter(f => f.is_blocking), [flags]);
  const selectedPanel = useMemo(() => panels.find(p => String(p.id) === form.values.panelId), [panels, form.values.panelId]);
  const selectedBattery = useMemo(() => batteries.find(b => String(b.id) === form.values.batteryId), [batteries, form.values.batteryId]);
  const selectedMppt = useMemo(() => mppts.find(m => String(m.id) === form.values.mpptId), [mppts, form.values.mpptId]);
  const totalArrayKwp = useMemo(
    () => selectedPanel ? (selectedPanel.power_w * (Number(form.values.panelQty) || 0)) / 1000 : 0,
    [selectedPanel, form.values.panelQty],
  );
  const layoutMismatch = useMemo(
    () => (Number(form.values.mountingRows) || 0) * (Number(form.values.mountingCols) || 0) !== (Number(form.values.panelQty) || 0),
    [form.values.mountingRows, form.values.mountingCols, form.values.panelQty],
  );

  // ── Error state ──
  if (editError) {
    return (
      <Stack align="center" p="xl">
        <Alert color="red" icon={<IconAlertCircle size={16} />} title="Error">{editError}</Alert>
        <Button onClick={() => navigate('/quotes')}>Back to Quotes</Button>
      </Stack>
    );
  }

  // ── Edit-mode skeleton ──
  if (editLoading) {
    return (
      <Stack>
        <Group justify="space-between">
          <Skeleton height={32} width={200} />
          <Skeleton height={24} width={120} radius="xl" />
        </Group>
        <Skeleton height={50} mt="md" />
        <Card shadow="sm" radius="md" withBorder p="lg" mt="md">
          <Stack>
            <Skeleton height={16} width="40%" />
            <Skeleton height={36} />
            <Group grow><Skeleton height={36} /><Skeleton height={36} /></Group>
            <Skeleton height={36} />
            <Skeleton height={16} width="30%" />
            <Skeleton height={36} />
            <Group grow><Skeleton height={36} /><Skeleton height={36} /></Group>
          </Stack>
        </Card>
      </Stack>
    );
  }

  // ── Section card header helper ──
  const SectionHeader = ({ icon, color, label }: { icon: React.ReactNode; color: string; label: string }) => (
    <Group gap="xs" mb="sm">
      <ThemeIcon variant="light" color={color} size="md">{icon}</ThemeIcon>
      <Text fw={600}>{label}</Text>
    </Group>
  );

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>{editMode ? `Edit ${quoteNumber}` : 'New Quote'}</Title>
        {quoteNumber && <Badge size="lg" variant="light">{quoteNumber}</Badge>}
      </Group>

      <Stepper active={activeStep} onStepClick={handleStepClick}>
        {/* ── Step 0: Client ── */}
        <Stepper.Step label="Client" description={stepDescs[0]} completedIcon={<IconCheck size={18} />}>
          <Card shadow="sm" radius="md" withBorder p="lg" mt="md">
            <SectionHeader icon={<IconUser size={16} />} color="blue" label="Client Details" />
            <Stack>
              {!form.values.newClient ? (
                <>
                  <Select
                    label="Select Client"
                    placeholder="Search clients..."
                    searchable
                    data={clients.map(c => ({ value: String(c.id), label: c.name }))}
                    value={form.values.selectedClientId || null}
                    onChange={(v) => form.setFieldValue('selectedClientId', v || '')}
                    error={form.errors.selectedClientId}
                  />
                  {form.values.selectedClientId && (() => {
                    const c = clients.find(cl => String(cl.id) === form.values.selectedClientId);
                    if (!c) return null;
                    return (
                      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
                        <Text size="sm" fw={600}>{c.name}</Text>
                        {c.phone && <Text size="xs" c="dimmed">{c.phone}</Text>}
                        {c.email && <Text size="xs" c="dimmed">{c.email}</Text>}
                        {c.address && <Text size="xs" c="dimmed">{c.address}</Text>}
                      </Alert>
                    );
                  })()}
                  <Button variant="subtle" size="xs" onClick={() => form.setFieldValue('newClient', true)}>
                    + Create new client
                  </Button>
                </>
              ) : (
                <>
                  <TextInput label="Name" required {...form.getInputProps('clientName')} />
                  <Group grow>
                    <TextInput label="Phone" placeholder="082 123 4567" {...form.getInputProps('clientPhone')} />
                    <TextInput label="Email" placeholder="client@example.com" {...form.getInputProps('clientEmail')} />
                  </Group>
                  <TextInput label="Address" placeholder="123 Main St, City" {...form.getInputProps('clientAddress')} />
                  <Button variant="subtle" size="xs" onClick={() => form.setFieldValue('newClient', false)}>
                    Back to client list
                  </Button>
                </>
              )}
            </Stack>
          </Card>
          <Group justify="flex-end" mt="md">
            <Button onClick={handleStep1Next} loading={loading} rightSection={<IconArrowRight size={16} />}>Next</Button>
          </Group>
        </Stepper.Step>

        {/* ── Step 1: System Class ── */}
        <Stepper.Step label="System" description={stepDescs[1]} completedIcon={<IconCheck size={18} />}>
          <Card shadow="sm" radius="md" withBorder p="lg" mt="md">
            <SectionHeader icon={<IconBolt size={16} />} color="violet" label="System Class" />
            <Stack>
              <Radio.Group
                label="Select system size"
                {...form.getInputProps('systemClass')}
              >
                <Stack mt="xs" gap="sm">
                  <Radio value="V5" label="V5 — 5 kVA" />
                  <Radio value="V8" label="V8 — 8 kVA" />
                  <Radio value="V10" label="V10 — 10 kVA" />
                  <Radio value="V15" label="V15 — 15 kVA" />
                </Stack>
              </Radio.Group>

              {inverterInfo && (
                <Card shadow="xs" radius="sm" withBorder p="sm" bg="violet.0">
                  <Text size="sm" fw={600}>{inverterInfo.name || 'Inverter'}</Text>
                  <Group gap="xs" mt={4}>
                    <Badge variant="light" color="violet" size="sm">{(inverterInfo.rated_va / 1000).toFixed(1)} kVA</Badge>
                    <Badge variant="light" color="blue" size="sm">AC: {inverterInfo.ac_output_amps}A</Badge>
                    <Badge variant="light" color="teal" size="sm">Max DC: {inverterInfo.max_dc_voltage}V</Badge>
                  </Group>
                </Card>
              )}
            </Stack>
          </Card>
          <Group justify="space-between" mt="md">
            <Button variant="default" onClick={() => setActiveStep(0)} leftSection={<IconArrowLeft size={16} />}>Back</Button>
            <Button onClick={handleStep2Next} loading={loading} rightSection={<IconArrowRight size={16} />}>Next</Button>
          </Group>
        </Stepper.Step>

        {/* ── Step 2: Components ── */}
        <Stepper.Step label="Components" description={stepDescs[2]} completedIcon={<IconCheck size={18} />}>
          <Stack mt="md" gap="md">
            {/* Solar Panels */}
            <Card shadow="sm" radius="md" withBorder p="lg">
              <SectionHeader icon={<IconSun size={16} />} color="yellow" label="Solar Panels" />
              <Group grow align="flex-start">
                <Select
                  label="Panel"
                  placeholder="Select panel"
                  searchable
                  data={panels.map(p => ({ value: String(p.id), label: `${p.name} (${p.power_w}W)` }))}
                  value={form.values.panelId || null}
                  onChange={(v) => form.setFieldValue('panelId', v || '')}
                  error={form.errors.panelId}
                  rightSection={panelsLoading ? <Loader size={16} /> : undefined}
                />
                <NumberInput
                  label="Quantity"
                  min={1} max={50}
                  value={form.values.panelQty}
                  onChange={(v) => form.setFieldValue('panelQty', Number(v) || 1)}
                  error={form.errors.panelQty}
                />
              </Group>
              {selectedPanel && (
                <Group gap="xs" mt="xs">
                  <Badge variant="light" color="yellow" size="sm">{selectedPanel.power_w}W</Badge>
                  <Badge variant="light" color="blue" size="sm">Voc: {selectedPanel.voc}V</Badge>
                  <Badge variant="light" color="teal" size="sm">Imp: {selectedPanel.imp}A</Badge>
                  <Badge variant="light" color="grape" size="sm">{totalArrayKwp.toFixed(1)} kWp array</Badge>
                </Group>
              )}
            </Card>

            {/* MPPT Recommendation */}
            {recommendation && (
              <Card shadow="sm" radius="md" withBorder p="md" bg={recommendation.warnings.length > 0 ? 'yellow.0' : 'blue.0'}>
                <Stack gap="xs">
                  <Group gap="xs">
                    <ThemeIcon variant="light" color={recommendation.warnings.length > 0 ? 'yellow' : 'blue'} size="md">
                      <IconBulb size={16} />
                    </ThemeIcon>
                    <Text size="sm" fw={600}>MPPT Recommendation</Text>
                  </Group>
                  <Text size="sm">
                    {recommendation.mppt_name} &times; {recommendation.mppt_qty} &mdash;{' '}
                    {recommendation.strings_count} string{recommendation.strings_count !== 1 ? 's' : ''} of{' '}
                    {recommendation.panels_per_string} panels
                  </Text>
                  <Group gap="xs">
                    <Badge variant="light" size="sm">{recommendation.oversize_pct}% utilization</Badge>
                    <Badge variant="light" size="sm">{(recommendation.total_pv_w / 1000).toFixed(1)} kW PV</Badge>
                  </Group>
                  {recommendation.warnings.map((w, i) => (
                    <Text key={i} size="xs" c="orange">{w}</Text>
                  ))}
                  {(form.values.mpptId !== String(recommendation.mppt_id) || Number(form.values.mpptQty) !== recommendation.mppt_qty) && (
                    <Button
                      size="xs" variant="light"
                      color={recommendation.warnings.length > 0 ? 'yellow' : 'blue'}
                      onClick={() => {
                        form.setFieldValue('mpptId', String(recommendation.mppt_id));
                        form.setFieldValue('mpptQty', recommendation.mppt_qty);
                        setIsAutoSelected(true);
                      }}
                    >
                      Apply Recommendation
                    </Button>
                  )}
                </Stack>
              </Card>
            )}

            {/* Battery */}
            <Card shadow="sm" radius="md" withBorder p="lg">
              <SectionHeader icon={<IconBolt size={16} />} color="green" label="Battery Storage" />
              <Group grow align="flex-start">
                <Select
                  label="Battery"
                  placeholder="Select battery"
                  searchable
                  data={batteries.map(b => ({ value: String(b.id), label: `${b.name || `Battery #${b.id}`} (${b.capacity_kwh}kWh, ${b.voltage}V)` }))}
                  value={form.values.batteryId || null}
                  onChange={(v) => form.setFieldValue('batteryId', v || '')}
                  error={form.errors.batteryId}
                  rightSection={batteriesLoading ? <Loader size={16} /> : undefined}
                />
                <NumberInput
                  label="Quantity"
                  min={1} max={10}
                  value={form.values.batteryQty}
                  onChange={(v) => form.setFieldValue('batteryQty', Number(v) || 1)}
                  error={form.errors.batteryQty}
                />
              </Group>
              {selectedBattery && (
                <Group gap="xs" mt="xs">
                  <Badge variant="light" color="green" size="sm">{selectedBattery.capacity_kwh}kWh</Badge>
                  <Badge variant="light" color="blue" size="sm">{selectedBattery.voltage}V</Badge>
                </Group>
              )}
            </Card>

            {/* MPPT Controller */}
            <Card shadow="sm" radius="md" withBorder p="lg">
              <SectionHeader icon={<IconBolt size={16} />} color="indigo" label="MPPT Controller" />
              <Group grow align="flex-start">
                <Select
                  label="MPPT"
                  placeholder="Select MPPT"
                  searchable
                  data={mppts.map(m => ({ value: String(m.id), label: `${m.name || m.model_code} (${m.max_charge_a}A)` }))}
                  value={form.values.mpptId || null}
                  onChange={(v) => { form.setFieldValue('mpptId', v || ''); setIsAutoSelected(false); }}
                  error={form.errors.mpptId}
                  rightSection={mpptsLoading ? <Loader size={16} /> : undefined}
                />
                <NumberInput
                  label="Quantity"
                  min={1} max={5}
                  value={form.values.mpptQty}
                  onChange={(v) => { form.setFieldValue('mpptQty', Number(v) || 1); setIsAutoSelected(false); }}
                  error={form.errors.mpptQty}
                />
              </Group>
              {selectedMppt && (
                <Group gap="xs" mt="xs">
                  <Badge variant="light" color="indigo" size="sm">Max PV: {selectedMppt.max_pv_voltage}V</Badge>
                  <Badge variant="light" color="blue" size="sm">Charge: {selectedMppt.max_charge_a}A</Badge>
                </Group>
              )}
              {!isAutoSelected && recommendation && (form.values.mpptId !== String(recommendation.mppt_id) || Number(form.values.mpptQty) !== recommendation.mppt_qty) && (
                <Text size="xs" c="dimmed" fs="italic" mt="xs">
                  Manual override &mdash; recommendation was {recommendation.mppt_name} &times; {recommendation.mppt_qty}
                </Text>
              )}
            </Card>
          </Stack>
          <Group justify="space-between" mt="md">
            <Button variant="default" onClick={() => setActiveStep(1)} leftSection={<IconArrowLeft size={16} />}>Back</Button>
            <Button onClick={handleStep3Next} loading={loading} rightSection={<IconArrowRight size={16} />}>Next</Button>
          </Group>
        </Stepper.Step>

        {/* ── Step 3: Installation ── */}
        <Stepper.Step label="Installation" description={stepDescs[3]} completedIcon={<IconCheck size={18} />}>
          <Stack mt="md" gap="md">
            {/* Mounting Configuration */}
            <Card shadow="sm" radius="md" withBorder p="lg">
              <SectionHeader icon={<IconHome size={16} />} color="orange" label="Mounting Configuration" />
              <Stack>
                <Select
                  label="Roof / mounting type"
                  data={[
                    { value: 'ibr', label: 'IBR Roof' },
                    { value: 'corrugated', label: 'Corrugated Roof' },
                    { value: 'tile', label: 'Tile Roof' },
                    { value: 'tilt_frame', label: 'Tilt Frame' },
                  ]}
                  value={form.values.mountingType}
                  onChange={v => form.setFieldValue('mountingType', v || 'tile')}
                />
                {form.values.mountingType === 'tilt_frame' && (
                  <Select
                    label="Tilt frame roof type"
                    data={[
                      { value: 'ibr', label: 'IBR' },
                      { value: 'corrugated', label: 'Corrugated' },
                    ]}
                    value={form.values.tiltRoofType}
                    onChange={v => form.setFieldValue('tiltRoofType', v || 'ibr')}
                  />
                )}
                <Group grow>
                  <NumberInput
                    label="Rows" description="Number of panel rows"
                    min={1} max={20}
                    value={form.values.mountingRows}
                    onChange={v => form.setFieldValue('mountingRows', Number(v) || 1)}
                    error={form.errors.mountingRows}
                  />
                  <NumberInput
                    label="Columns" description="Number of panel columns"
                    min={1} max={20}
                    value={form.values.mountingCols}
                    onChange={v => form.setFieldValue('mountingCols', Number(v) || 1)}
                    error={form.errors.mountingCols}
                  />
                </Group>
                {layoutMismatch ? (
                  <Alert color="orange" icon={<IconAlertTriangle size={16} />} variant="light">
                    Layout: {form.values.mountingRows} &times; {form.values.mountingCols} = {Number(form.values.mountingRows) * Number(form.values.mountingCols)} panels,
                    but panel quantity is {form.values.panelQty}. Mounting hardware will be calculated for the layout grid.
                  </Alert>
                ) : (
                  <Text size="sm" c="dimmed">
                    Layout: {form.values.mountingRows} &times; {form.values.mountingCols} = {Number(form.values.mountingRows) * Number(form.values.mountingCols)} panels
                  </Text>
                )}
              </Stack>
            </Card>

            {/* Cable Distances & Travel */}
            <Card shadow="sm" radius="md" withBorder p="lg">
              <SectionHeader icon={<IconReceipt size={16} />} color="cyan" label="Cable Distances & Travel" />
              <SimpleGrid cols={2}>
                <NumberInput
                  label="DC battery distance" description="Batteries to inverter (metres)"
                  placeholder="1.5"
                  min={0} step={0.5} decimalScale={1}
                  value={form.values.dcBatteryDist}
                  onChange={v => form.setFieldValue('dcBatteryDist', Number(v) || 0)}
                />
                <NumberInput
                  label="AC inverter to DB" description="Inverter to distribution board (metres)"
                  placeholder="5"
                  min={0} step={0.5} decimalScale={1}
                  value={form.values.acInvDbDist}
                  onChange={v => form.setFieldValue('acInvDbDist', Number(v) || 0)}
                />
                <NumberInput
                  label="AC DB to grid" description="Distribution board to grid tie-in (metres)"
                  placeholder="10"
                  min={0} step={0.5} decimalScale={1}
                  value={form.values.acDbGridDist}
                  onChange={v => form.setFieldValue('acDbGridDist', Number(v) || 0)}
                />
                <NumberInput
                  label="PV string length" description="Total PV string cable run (metres)"
                  placeholder="20"
                  min={0} step={1} decimalScale={1}
                  value={form.values.pvStringLen}
                  onChange={v => form.setFieldValue('pvStringLen', Number(v) || 0)}
                />
              </SimpleGrid>
              <NumberInput
                label="Travel distance" description="Site distance for travel cost (km)"
                placeholder="0"
                min={0} step={5} mt="sm" w="50%"
                value={form.values.travelDist}
                onChange={v => form.setFieldValue('travelDist', Number(v) || 0)}
              />
            </Card>

            {/* Notes */}
            <Card shadow="sm" radius="md" withBorder p="lg">
              <SectionHeader icon={<IconInfoCircle size={16} />} color="gray" label="Notes" />
              <Textarea
                placeholder="Any special instructions or site notes..."
                minRows={3}
                {...form.getInputProps('notes')}
              />
            </Card>
          </Stack>
          <Group justify="space-between" mt="md">
            <Button variant="default" onClick={() => setActiveStep(2)} leftSection={<IconArrowLeft size={16} />}>Back</Button>
            <Button onClick={handleStep4Next} loading={loading} rightSection={<IconArrowRight size={16} />}>Generate BoM</Button>
          </Group>
        </Stepper.Step>

        {/* ── Step 4: Review ── */}
        <Stepper.Step label="Review" description={stepDescs[4]} completedIcon={<IconCheck size={18} />}>
          <Stack mt="md" gap="md">
            {/* Flags with "Go fix" buttons */}
            {flags.map((flag, i) => (
              <Alert
                key={i}
                color={flag.severity === 'error' ? 'red' : flag.severity === 'warning' ? 'yellow' : 'blue'}
                icon={flag.severity === 'error' ? <IconAlertCircle size={16} /> : flag.severity === 'warning' ? <IconAlertTriangle size={16} /> : <IconInfoCircle size={16} />}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm">{flag.message}</Text>
                  {flagToStep(flag.code) !== null && (
                    <Button size="xs" variant="subtle" onClick={() => setActiveStep(flagToStep(flag.code)!)}>
                      Go fix
                    </Button>
                  )}
                </Group>
              </Alert>
            ))}

            {/* String configuration card */}
            {stringsCount > 0 && (
              <Card shadow="sm" radius="sm" withBorder p="md" bg="blue.0">
                <Group gap="sm">
                  <ThemeIcon variant="light" color="blue" size="md"><IconBolt size={16} /></ThemeIcon>
                  <div>
                    <Text size="sm" fw={600}>PV String Configuration</Text>
                    <Text size="sm">
                      {stringsCount} string{stringsCount !== 1 ? 's' : ''} of {panelsPerString} panels
                    </Text>
                  </div>
                </Group>
              </Card>
            )}

            {/* BoM tables grouped by section */}
            {SECTION_ORDER.map(section => {
              const items = groupedBom[section];
              if (!items || items.length === 0) return null;
              const sectionTotal = items.reduce((sum, item) => sum + item.line_total_cents, 0);
              return (
                <Card key={section} shadow="sm" radius="md" withBorder p={0}>
                  <Group bg="gray.1" px="md" py="xs" justify="space-between">
                    <Text fw={600} size="sm">{SECTION_LABELS[section] || section}</Text>
                    <Text fw={500} size="sm" c="dimmed">{formatPrice(sectionTotal)}</Text>
                  </Group>
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th w="12%">SKU</Table.Th>
                        <Table.Th w="43%">Description</Table.Th>
                        <Table.Th w="10%" ta="center">Qty</Table.Th>
                        <Table.Th w="17%" ta="right">Unit Price</Table.Th>
                        <Table.Th w="18%" ta="right">Total</Table.Th>
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

            {/* Totals card */}
            {totals && (
              <Card shadow="sm" radius="md" withBorder p="lg" bg="blue.0">
                <Group justify="space-between" align="flex-start">
                  <Group gap="sm">
                    <ThemeIcon variant="light" color="blue" size="lg"><IconReceipt size={20} /></ThemeIcon>
                    <div>
                      <Text size="sm" c="dimmed">Total (incl. VAT)</Text>
                      <Text size="xl" fw={700}>{formatPrice(totals.total_cents)}</Text>
                    </div>
                  </Group>
                  <Stack gap="xs" align="flex-end">
                    <Group gap="xl">
                      <Text size="sm" c="dimmed">Subtotal:</Text>
                      <Text size="sm" fw={500}>{formatPrice(totals.subtotal_cents)}</Text>
                    </Group>
                    <Group gap="xl">
                      <Text size="sm" c="dimmed">VAT (15%):</Text>
                      <Text size="sm" fw={500}>{formatPrice(totals.vat_cents)}</Text>
                    </Group>
                  </Stack>
                </Group>
              </Card>
            )}

            {/* Actions */}
            <Group justify="space-between" mt="md">
              <Button variant="default" onClick={() => setActiveStep(3)} leftSection={<IconArrowLeft size={16} />}>Back</Button>
              <Group>
                <Button
                  variant="outline"
                  onClick={handleDownloadPdf}
                  loading={pdfLoading}
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
