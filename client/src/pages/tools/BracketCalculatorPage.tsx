import { useState, useEffect } from 'react';
import {
  Card, Title, Stack, SegmentedControl, Select, NumberInput,
  Button, Table, Alert, Text, Group, Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCalculator, IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import { getPanels } from '../../api/panels.api';
import { calculateMounting, MountingCalculateResult } from '../../api/tools.api';

const formatPrice = (cents: number) =>
  `R ${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

interface Panel {
  id: number;
  name: string;
  power_w: number;
  width_mm: number | null;
}

export default function BracketCalculatorPage() {
  const [mountingType, setMountingType] = useState('ibr');
  const [tiltRoofType, setTiltRoofType] = useState('ibr');
  const [panelSource, setPanelSource] = useState('database');
  const [panelId, setPanelId] = useState<string | null>(null);
  const [widthMm, setWidthMm] = useState<number | ''>(1134);
  const [rows, setRows] = useState<number | ''>(2);
  const [cols, setCols] = useState<number | ''>(6);

  const [panels, setPanels] = useState<Panel[]>([]);
  const [loadingPanels, setLoadingPanels] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<MountingCalculateResult | null>(null);

  useEffect(() => {
    setLoadingPanels(true);
    getPanels('approved')
      .then((data: Panel[]) => setPanels(data))
      .catch(() => notifications.show({ title: 'Error', message: 'Failed to load panels', color: 'red' }))
      .finally(() => setLoadingPanels(false));
  }, []);

  const panelQty = (typeof rows === 'number' && typeof cols === 'number') ? rows * cols : 0;

  const handleCalculate = async () => {
    if (typeof rows !== 'number' || typeof cols !== 'number' || rows < 1 || cols < 1) {
      notifications.show({ title: 'Validation', message: 'Rows and columns must be at least 1', color: 'orange' });
      return;
    }

    if (panelSource === 'database' && !panelId) {
      notifications.show({ title: 'Validation', message: 'Select a panel from the database', color: 'orange' });
      return;
    }

    if (panelSource === 'manual' && (typeof widthMm !== 'number' || widthMm < 100)) {
      notifications.show({ title: 'Validation', message: 'Enter a valid panel width (mm)', color: 'orange' });
      return;
    }

    setCalculating(true);
    setResult(null);

    try {
      const resolvedType = mountingType === 'tilt_frame' ? `tilt_frame_${tiltRoofType}` : mountingType;
      const input = panelSource === 'database'
        ? { mounting_type: resolvedType as any, panel_id: Number(panelId), rows, cols }
        : { mounting_type: resolvedType as any, width_mm: widthMm as number, rows, cols };

      const data = await calculateMounting(input);
      setResult(data);
    } catch (err: any) {
      notifications.show({
        title: 'Calculation Failed',
        message: err.response?.data?.error || 'Unexpected error',
        color: 'red',
      });
    } finally {
      setCalculating(false);
    }
  };

  return (
    <Stack gap="lg">
      <Title order={2}>Bracket Calculator</Title>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Text fw={500}>Mounting Type</Text>
          <SegmentedControl
            value={mountingType}
            onChange={setMountingType}
            data={[
              { label: 'IBR Roof', value: 'ibr' },
              { label: 'Corrugated Roof', value: 'corrugated' },
              { label: 'Tile Roof', value: 'tile' },
              { label: 'Tilt Frame', value: 'tilt_frame' },
            ]}
          />

          {mountingType === 'tilt_frame' && (
            <>
              <Text fw={500}>Tilt Frame Roof Type</Text>
              <SegmentedControl
                value={tiltRoofType}
                onChange={setTiltRoofType}
                data={[
                  { label: 'IBR', value: 'ibr' },
                  { label: 'Corrugated', value: 'corrugated' },
                ]}
              />
            </>
          )}

          <Text fw={500}>Panel Source</Text>
          <SegmentedControl
            value={panelSource}
            onChange={(v) => { setPanelSource(v); setResult(null); }}
            data={[
              { label: 'Database', value: 'database' },
              { label: 'Manual', value: 'manual' },
            ]}
          />

          {panelSource === 'database' ? (
            <Select
              label="Panel"
              placeholder={loadingPanels ? 'Loading panels...' : 'Select approved panel'}
              searchable
              data={panels.map((p) => ({
                value: String(p.id),
                label: `${p.name} (${p.power_w}W)`,
              }))}
              value={panelId}
              onChange={setPanelId}
              rightSection={loadingPanels ? <Loader size={16} /> : undefined}
            />
          ) : (
            <NumberInput
              label="Panel Width (mm)"
              value={widthMm}
              onChange={(v) => setWidthMm(v as number | '')}
              min={100}
              max={3000}
              step={1}
            />
          )}

          <Group grow>
            <NumberInput
              label="Rows"
              value={rows}
              onChange={(v) => setRows(v as number | '')}
              min={1}
              max={50}
            />
            <NumberInput
              label="Columns"
              value={cols}
              onChange={(v) => setCols(v as number | '')}
              min={1}
              max={50}
            />
          </Group>

          <Text size="sm" c="dimmed">
            Panel qty: {typeof rows === 'number' ? rows : '?'} x {typeof cols === 'number' ? cols : '?'} = {panelQty}
          </Text>

          <Button
            leftSection={<IconCalculator size={18} />}
            onClick={handleCalculate}
            loading={calculating}
          >
            Calculate
          </Button>
        </Stack>
      </Card>

      {result && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Title order={4}>Results</Title>

            {result.flags.map((flag, i) => (
              <Alert
                key={i}
                color={flag.severity === 'error' ? 'red' : flag.severity === 'warning' ? 'orange' : 'blue'}
                icon={flag.severity === 'warning' ? <IconAlertTriangle size={18} /> : <IconInfoCircle size={18} />}
                title={flag.code}
              >
                {flag.message}
              </Alert>
            ))}

            {result.items.length === 0 ? (
              <Text c="dimmed">No mounting items generated. Check flags above.</Text>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Product</Table.Th>
                    <Table.Th>SKU</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Qty</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Unit Price</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Line Total</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {result.items.map((item, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{item.name}</Table.Td>
                      <Table.Td>{item.sku}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>{item.quantity}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>{formatPrice(item.unit_price_cents)}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>{formatPrice(item.line_total_cents)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
                <Table.Tfoot>
                  <Table.Tr>
                    <Table.Td colSpan={4} style={{ textAlign: 'right', fontWeight: 700 }}>
                      Grand Total (excl. VAT)
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', fontWeight: 700 }}>
                      {formatPrice(result.grand_total_cents)}
                    </Table.Td>
                  </Table.Tr>
                </Table.Tfoot>
              </Table>
            )}

            <Text size="xs" c="dimmed">
              Prices exclude VAT. For a full system quote, use the Quotes section.
            </Text>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
