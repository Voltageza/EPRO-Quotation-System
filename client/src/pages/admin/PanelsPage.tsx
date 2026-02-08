import { useState, useEffect, useCallback } from 'react';
import {
  Title, Card, Stack, Group, Button, Table, Badge, Text,
  Modal, TextInput, NumberInput, FileInput, Loader, Alert,
  Tabs, Divider, ActionIcon, Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconUpload, IconCheck, IconX, IconAlertTriangle,
  IconEye, IconShieldCheck, IconShieldX,
} from '@tabler/icons-react';
import {
  getPanels, uploadDatasheet, createPanel,
  approvePanel, rejectPanel, validatePanel,
} from '../../api/panels.api';

interface Panel {
  id: number;
  product_id: number;
  sku: string;
  name: string;
  retail_price: number;
  power_w: number;
  voc: number;
  vmp: number;
  isc: number;
  imp: number;
  temp_coeff_voc: number;
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
  weight_kg: number | null;
  status: 'pending' | 'approved' | 'rejected';
}

interface ValidationResult {
  valid: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    value: number;
    limit: number;
    message: string;
  }>;
}

interface ExtractedSpecs {
  power_w: number | null;
  voc: number | null;
  vmp: number | null;
  isc: number | null;
  imp: number | null;
  temp_coeff_voc: number | null;
  width_mm: number | null;
  height_mm: number | null;
  missing_fields: string[];
  extraction_method?: 'text' | 'ocr' | 'image-ocr';
}

export default function PanelsPage() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('all');

  // Upload modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedSpecs | null>(null);
  const [datastorePath, setDatastorePath] = useState('');

  // Create/Edit form
  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState(0);
  const [formPower, setFormPower] = useState<number | ''>('');
  const [formVoc, setFormVoc] = useState<number | ''>('');
  const [formVmp, setFormVmp] = useState<number | ''>('');
  const [formIsc, setFormIsc] = useState<number | ''>('');
  const [formImp, setFormImp] = useState<number | ''>('');
  const [formTempCoeff, setFormTempCoeff] = useState<number | ''>('');
  const [formWidth, setFormWidth] = useState<number | ''>('');
  const [formHeight, setFormHeight] = useState<number | ''>('');

  // Detail/Validation modal
  const [detailPanel, setDetailPanel] = useState<Panel | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  const loadPanels = useCallback(async () => {
    setLoading(true);
    try {
      const status = activeTab === 'all' ? undefined : activeTab || undefined;
      setPanels(await getPanels(status));
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load panels', color: 'red' });
    }
    setLoading(false);
  }, [activeTab]);

  useEffect(() => { loadPanels(); }, [loadPanels]);

  const handleUploadPdf = async () => {
    if (!pdfFile) return;
    setUploading(true);
    try {
      const result = await uploadDatasheet(pdfFile);
      setExtracted(result.extracted);
      setDatastorePath(result.file.path);

      // Pre-fill form from extraction
      if (result.extracted.power_w) setFormPower(result.extracted.power_w);
      if (result.extracted.voc) setFormVoc(result.extracted.voc);
      if (result.extracted.vmp) setFormVmp(result.extracted.vmp);
      if (result.extracted.isc) setFormIsc(result.extracted.isc);
      if (result.extracted.imp) setFormImp(result.extracted.imp);
      if (result.extracted.temp_coeff_voc) setFormTempCoeff(result.extracted.temp_coeff_voc);
      if (result.extracted.width_mm) setFormWidth(result.extracted.width_mm);
      if (result.extracted.height_mm) setFormHeight(result.extracted.height_mm);

      const method = result.extracted.extraction_method;
      const methodLabel = method === 'ocr' ? 'OCR (image PDF)' : method === 'image-ocr' ? 'OCR (image file)' : 'text extraction';
      const missingCount = result.extracted.missing_fields.length;
      const allMissing = missingCount >= 6;
      notifications.show({
        title: allMissing
          ? 'Could not extract specs'
          : missingCount > 0
            ? `Partially extracted via ${methodLabel}`
            : `Extracted via ${methodLabel}`,
        message: allMissing
          ? `Used ${methodLabel} but could not find spec values. Please enter all specs manually below.`
          : missingCount > 0
            ? `Missing: ${result.extracted.missing_fields.join(', ')} — fill manually below`
            : 'All fields extracted successfully!',
        color: allMissing ? 'orange' : missingCount > 0 ? 'yellow' : 'green',
      });
    } catch (err: any) {
      notifications.show({ title: 'Upload Failed', message: err.response?.data?.error || 'Error', color: 'red' });
    }
    setUploading(false);
  };

  const handleCreatePanel = async () => {
    if (!formSku || !formName || !formPower || !formVoc || !formVmp || !formIsc || !formImp || !formTempCoeff) {
      notifications.show({ title: 'Error', message: 'All electrical specs are required', color: 'red' });
      return;
    }
    try {
      await createPanel({
        sku: formSku, name: formName, retail_price: Math.round(formPrice * 100),
        power_w: formPower as number, voc: formVoc as number, vmp: formVmp as number,
        isc: formIsc as number, imp: formImp as number, temp_coeff_voc: formTempCoeff as number,
        width_mm: formWidth as number || undefined, height_mm: formHeight as number || undefined,
        datasheet_path: datastorePath || undefined,
      });
      notifications.show({ title: 'Created', message: 'Panel created — awaiting approval', color: 'green' });
      setUploadOpen(false);
      resetForm();
      loadPanels();
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err.response?.data?.error || 'Failed', color: 'red' });
    }
  };

  const resetForm = () => {
    setPdfFile(null); setExtracted(null); setDatastorePath('');
    setFormSku(''); setFormName(''); setFormPrice(0);
    setFormPower(''); setFormVoc(''); setFormVmp('');
    setFormIsc(''); setFormImp(''); setFormTempCoeff('');
    setFormWidth(''); setFormHeight('');
  };

  const openDetail = async (panel: Panel) => {
    setDetailPanel(panel);
    try {
      const v = await validatePanel(panel.id);
      setValidation(v);
    } catch {
      setValidation(null);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await approvePanel(id);
      notifications.show({ title: 'Approved', message: 'Panel approved for use in quotes', color: 'green' });
      setDetailPanel(null);
      loadPanels();
    } catch (err: any) {
      notifications.show({ title: 'Cannot Approve', message: err.response?.data?.error || 'Validation failed', color: 'red' });
    }
  };

  const handleReject = async (id: number) => {
    try {
      await rejectPanel(id);
      notifications.show({ title: 'Rejected', message: 'Panel rejected', color: 'orange' });
      setDetailPanel(null);
      loadPanels();
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to reject', color: 'red' });
    }
  };

  const statusColor: Record<string, string> = { pending: 'yellow', approved: 'green', rejected: 'red' };

  const formatPrice = (cents: number) => `R ${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Panel Management</Title>
        <Button leftSection={<IconUpload size={16} />} onClick={() => { resetForm(); setUploadOpen(true); }}>
          Import Panel
        </Button>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="all">All</Tabs.Tab>
          <Tabs.Tab value="pending" leftSection={<Badge size="xs" color="yellow" circle>{panels.filter(p => p.status === 'pending').length || ''}</Badge>}>Pending</Tabs.Tab>
          <Tabs.Tab value="approved">Approved</Tabs.Tab>
          <Tabs.Tab value="rejected">Rejected</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <Card shadow="sm" radius="md" withBorder p={0}>
        {loading ? (
          <Group justify="center" p="xl"><Loader /></Group>
        ) : panels.length === 0 ? (
          <Text ta="center" p="xl" c="dimmed">No panels found. Import a panel datasheet to get started.</Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>SKU</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th ta="right">Power</Table.Th>
                <Table.Th ta="right">Voc</Table.Th>
                <Table.Th ta="right">Imp</Table.Th>
                <Table.Th ta="right">Price</Table.Th>
                <Table.Th ta="center">Status</Table.Th>
                <Table.Th ta="center">Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {panels.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td><Text size="sm" fw={500}>{p.sku}</Text></Table.Td>
                  <Table.Td>{p.name}</Table.Td>
                  <Table.Td ta="right">{p.power_w}W</Table.Td>
                  <Table.Td ta="right">{p.voc}V</Table.Td>
                  <Table.Td ta="right">{p.imp}A</Table.Td>
                  <Table.Td ta="right">{formatPrice(p.retail_price)}</Table.Td>
                  <Table.Td ta="center">
                    <Badge color={statusColor[p.status]} variant="light">{p.status}</Badge>
                  </Table.Td>
                  <Table.Td ta="center">
                    <Group gap="xs" justify="center">
                      <Tooltip label="View & Validate">
                        <ActionIcon variant="subtle" onClick={() => openDetail(p)}>
                          <IconEye size={16} />
                        </ActionIcon>
                      </Tooltip>
                      {p.status === 'pending' && (
                        <>
                          <Tooltip label="Approve">
                            <ActionIcon variant="subtle" color="green" onClick={() => handleApprove(p.id)}>
                              <IconShieldCheck size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Reject">
                            <ActionIcon variant="subtle" color="red" onClick={() => handleReject(p.id)}>
                              <IconShieldX size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Upload & Create Modal */}
      <Modal opened={uploadOpen} onClose={() => setUploadOpen(false)} title="Import Solar Panel" size="lg">
        <Stack>
          <Card withBorder p="sm">
            <Text fw={600} mb="xs">Step 1: Upload Datasheet (optional)</Text>
            <Group>
              <FileInput
                placeholder="Select PDF or image datasheet"
                accept="application/pdf,image/png,image/jpeg"
                value={pdfFile}
                onChange={setPdfFile}
                style={{ flex: 1 }}
              />
              <Button onClick={handleUploadPdf} loading={uploading} disabled={!pdfFile}>
                Parse Datasheet
              </Button>
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              Supports PDF, PNG, and JPG. Image files use OCR (5-15 seconds).
            </Text>
            {extracted?.missing_fields && extracted.missing_fields.length > 0 && (
              <Alert icon={<IconAlertTriangle size={16} />} color={extracted.missing_fields.length >= 6 ? 'orange' : 'yellow'} mt="sm">
                {extracted.missing_fields.length >= 6
                  ? 'Could not extract spec values from this file. Please enter all specs manually below.'
                  : `Missing fields: ${extracted.missing_fields.join(', ')} — please fill manually below`}
              </Alert>
            )}
          </Card>

          <Divider label="Step 2: Confirm / Enter Specs" />

          <Group grow>
            <TextInput label="SKU" required value={formSku} onChange={(e) => setFormSku(e.target.value)} placeholder="e.g. SOLAR48" />
            <TextInput label="Panel Name" required value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. JA 610W BiFacial" />
          </Group>
          <NumberInput label="Retail Price (R)" prefix="R " value={formPrice} onChange={(v) => setFormPrice(typeof v === 'number' ? v : 0)} decimalScale={2} />

          <Divider label="Electrical Specifications" />
          <Group grow>
            <NumberInput label="Power (W)" required value={formPower} onChange={(v) => setFormPower(typeof v === 'number' ? v : '')} />
            <NumberInput label="Voc (V)" required value={formVoc} onChange={(v) => setFormVoc(typeof v === 'number' ? v : '')} decimalScale={2} />
            <NumberInput label="Vmp (V)" required value={formVmp} onChange={(v) => setFormVmp(typeof v === 'number' ? v : '')} decimalScale={2} />
          </Group>
          <Group grow>
            <NumberInput label="Isc (A)" required value={formIsc} onChange={(v) => setFormIsc(typeof v === 'number' ? v : '')} decimalScale={2} />
            <NumberInput label="Imp (A)" required value={formImp} onChange={(v) => setFormImp(typeof v === 'number' ? v : '')} decimalScale={2} />
            <NumberInput label="Temp Coeff Voc (%/°C)" required value={formTempCoeff} onChange={(v) => setFormTempCoeff(typeof v === 'number' ? v : '')} decimalScale={3} />
          </Group>

          <Divider label="Dimensions (optional)" />
          <Group grow>
            <NumberInput label="Width (mm)" value={formWidth} onChange={(v) => setFormWidth(typeof v === 'number' ? v : '')} />
            <NumberInput label="Height (mm)" value={formHeight} onChange={(v) => setFormHeight(typeof v === 'number' ? v : '')} />
          </Group>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button onClick={handleCreatePanel}>Create Panel</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Detail & Validation Modal */}
      <Modal opened={!!detailPanel} onClose={() => { setDetailPanel(null); setValidation(null); }} title="Panel Details" size="lg">
        {detailPanel && (
          <Stack>
            <Group>
              <Text fw={700}>{detailPanel.sku}</Text>
              <Text>{detailPanel.name}</Text>
              <Badge color={statusColor[detailPanel.status]}>{detailPanel.status}</Badge>
            </Group>

            <Card withBorder p="sm">
              <Title order={5} mb="xs">Electrical Specifications</Title>
              <Table>
                <Table.Tbody>
                  <Table.Tr><Table.Td fw={500}>Power</Table.Td><Table.Td>{detailPanel.power_w} W</Table.Td></Table.Tr>
                  <Table.Tr><Table.Td fw={500}>Voc</Table.Td><Table.Td>{detailPanel.voc} V</Table.Td></Table.Tr>
                  <Table.Tr><Table.Td fw={500}>Vmp</Table.Td><Table.Td>{detailPanel.vmp} V</Table.Td></Table.Tr>
                  <Table.Tr><Table.Td fw={500}>Isc</Table.Td><Table.Td>{detailPanel.isc} A</Table.Td></Table.Tr>
                  <Table.Tr><Table.Td fw={500}>Imp</Table.Td><Table.Td>{detailPanel.imp} A</Table.Td></Table.Tr>
                  <Table.Tr><Table.Td fw={500}>Temp Coeff Voc</Table.Td><Table.Td>{detailPanel.temp_coeff_voc} %/°C</Table.Td></Table.Tr>
                  {detailPanel.width_mm && <Table.Tr><Table.Td fw={500}>Dimensions</Table.Td><Table.Td>{detailPanel.width_mm} × {detailPanel.height_mm} mm</Table.Td></Table.Tr>}
                </Table.Tbody>
              </Table>
            </Card>

            {validation && (
              <Card withBorder p="sm">
                <Title order={5} mb="xs">Validation Results</Title>
                {validation.checks.map((check, i) => (
                  <Alert
                    key={i}
                    icon={check.passed ? <IconCheck size={16} /> : <IconX size={16} />}
                    color={check.passed ? 'green' : 'red'}
                    mb="xs"
                  >
                    <Text size="sm" fw={500}>{check.name}</Text>
                    <Text size="sm">{check.message}</Text>
                  </Alert>
                ))}
              </Card>
            )}

            {detailPanel.status === 'pending' && (
              <Group justify="flex-end">
                <Button color="red" variant="outline" onClick={() => handleReject(detailPanel.id)} leftSection={<IconShieldX size={16} />}>
                  Reject
                </Button>
                <Button color="green" onClick={() => handleApprove(detailPanel.id)} leftSection={<IconShieldCheck size={16} />}>
                  Approve
                </Button>
              </Group>
            )}
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
