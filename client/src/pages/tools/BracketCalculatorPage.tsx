import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card, Title, Stack, SegmentedControl, Select, NumberInput,
  Button, Table, Alert, Text, Group, Loader, ActionIcon,
  TextInput, Accordion, Badge, Tabs, FileInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCalculator, IconAlertTriangle, IconInfoCircle,
  IconPlus, IconCopy, IconTrash, IconPhoto, IconUpload,
} from '@tabler/icons-react';
import { getPanels } from '../../api/panels.api';
import {
  calculateMountingMulti,
  calculateMountingIrregular,
  analyzePhoto,
  MountingMultiResult,
  MountingGroupInput,
  MountingResultItem,
  IrregularGroupInput,
} from '../../api/tools.api';

const formatPrice = (cents: number) =>
  `R ${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

interface Panel {
  id: number;
  name: string;
  power_w: number;
  width_mm: number | null;
}

interface GroupState {
  id: string;
  label: string;
  mountingType: string;
  tiltRoofType: string;
  panelSource: 'database' | 'manual';
  panelId: string | null;
  widthMm: number | '';
  rows: number | '';
  cols: number | '';
}

let groupCounter = 0;
function createGroup(overrides?: Partial<GroupState>): GroupState {
  groupCounter++;
  return {
    id: crypto.randomUUID(),
    label: `Array ${groupCounter}`,
    mountingType: 'ibr',
    tiltRoofType: 'ibr',
    panelSource: 'database',
    panelId: null,
    widthMm: 1134,
    rows: 2,
    cols: 6,
    ...overrides,
  };
}

// --- Shared components ---

function ItemsTable({ items, totalLabel, totalCents }: {
  items: MountingResultItem[];
  totalLabel: string;
  totalCents: number;
}) {
  return (
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
        {items.map((item, i) => (
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
            {totalLabel}
          </Table.Td>
          <Table.Td style={{ textAlign: 'right', fontWeight: 700 }}>
            {formatPrice(totalCents)}
          </Table.Td>
        </Table.Tr>
      </Table.Tfoot>
    </Table>
  );
}

function MountingResults({ result }: { result: MountingMultiResult }) {
  return (
    <Stack gap="lg">
      {/* Per-group accordion */}
      {result.groups.length > 1 && (
        <Accordion variant="contained" radius="md">
          {result.groups.map((gr, i) => (
            <Accordion.Item key={i} value={`group-${i}`}>
              <Accordion.Control>
                <Group gap="sm">
                  <Text fw={600}>{gr.label}</Text>
                  <Badge variant="light" size="sm">
                    {gr.panel_count} panel{gr.panel_count !== 1 ? 's' : ''}
                  </Badge>
                  <Text size="sm" c="dimmed" ml="auto">
                    {formatPrice(gr.subtotal_cents)}
                  </Text>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  {gr.flags.map((flag, fi) => (
                    <Alert
                      key={fi}
                      color={flag.severity === 'error' ? 'red' : flag.severity === 'warning' ? 'orange' : 'blue'}
                      icon={flag.severity === 'warning' ? <IconAlertTriangle size={18} /> : <IconInfoCircle size={18} />}
                      title={flag.code}
                    >
                      {flag.message}
                    </Alert>
                  ))}
                  {gr.items.length === 0 ? (
                    <Text c="dimmed">No mounting items generated.</Text>
                  ) : (
                    <ItemsTable
                      items={gr.items}
                      totalLabel="Subtotal (excl. VAT)"
                      totalCents={gr.subtotal_cents}
                    />
                  )}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      )}

      {/* Combined BoM */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Title order={4}>
            {result.groups.length > 1 ? 'Combined Bill of Materials' : 'Results'}
          </Title>

          {result.groups.length === 1 && result.combined.flags.map((flag, i) => (
            <Alert
              key={i}
              color={flag.severity === 'error' ? 'red' : flag.severity === 'warning' ? 'orange' : 'blue'}
              icon={flag.severity === 'warning' ? <IconAlertTriangle size={18} /> : <IconInfoCircle size={18} />}
              title={flag.code}
            >
              {flag.message}
            </Alert>
          ))}

          {result.combined.items.length === 0 ? (
            <Text c="dimmed">No mounting items generated. Check flags above.</Text>
          ) : (
            <>
              {result.groups.length > 1 && (
                <Text size="sm" c="dimmed">
                  {result.combined.total_panels} panels across {result.groups.length} arrays
                </Text>
              )}
              <ItemsTable
                items={result.combined.items}
                totalLabel="Grand Total (excl. VAT)"
                totalCents={result.combined.grand_total_cents}
              />
            </>
          )}

          <Text size="xs" c="dimmed">
            Prices exclude VAT. For a full system quote, use the Quotes section.
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}

// --- Grid helpers ---

const GRID_ROWS = 10;
const GRID_COLS = 10;

function createEmptyGrid(): boolean[][] {
  return Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(false));
}

function gridFromRowCounts(rows: number[]): boolean[][] {
  const grid = createEmptyGrid();
  for (let r = 0; r < rows.length && r < GRID_ROWS; r++) {
    for (let c = 0; c < rows[r] && c < GRID_COLS; c++) {
      grid[r][c] = true;
    }
  }
  return grid;
}

function countGridPanels(cells: boolean[][]): number {
  return cells.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
}

function getGridActiveRows(cells: boolean[][]): number {
  return cells.filter((row) => row.some(Boolean)).length;
}

function getGridMaxCols(cells: boolean[][]): number {
  return cells.reduce((max, row) => Math.max(max, row.filter(Boolean).length), 0);
}

// --- Clickable grid component ---

function PanelGrid({ cells, onChange }: { cells: boolean[][]; onChange: (cells: boolean[][]) => void }) {
  const draggingRef = useRef(false);
  const targetRef = useRef(false);
  const cellsRef = useRef(cells);
  cellsRef.current = cells;

  const handleMouseDown = (r: number, c: number) => {
    draggingRef.current = true;
    targetRef.current = !cells[r][c];
    const next = cells.map((row) => [...row]);
    next[r][c] = targetRef.current;
    onChange(next);
  };

  const handleMouseEnter = (r: number, c: number) => {
    if (!draggingRef.current) return;
    const cur = cellsRef.current;
    if (cur[r][c] !== targetRef.current) {
      const next = cur.map((row) => [...row]);
      next[r][c] = targetRef.current;
      onChange(next);
    }
  };

  useEffect(() => {
    const up = () => { draggingRef.current = false; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  return (
    <div style={{ userSelect: 'none' }}>
      {/* Column numbers */}
      <div style={{ display: 'flex', gap: 2, marginLeft: 28, marginBottom: 2 }}>
        {Array.from({ length: GRID_COLS }, (_, c) => (
          <div key={c} style={{ width: 32, textAlign: 'center', fontSize: 10, color: '#868e96' }}>{c + 1}</div>
        ))}
      </div>
      {cells.map((row, r) => (
        <div key={r} style={{ display: 'flex', gap: 2, alignItems: 'center', marginBottom: 2 }}>
          <div style={{ width: 24, fontSize: 10, color: '#868e96', textAlign: 'right', marginRight: 2 }}>{r + 1}</div>
          {row.map((active, c) => (
            <div
              key={c}
              onMouseDown={(e) => { e.preventDefault(); handleMouseDown(r, c); }}
              onMouseEnter={() => handleMouseEnter(r, c)}
              style={{
                width: 32,
                height: 32,
                backgroundColor: active ? '#228be6' : '#f1f3f5',
                border: `1px solid ${active ? '#1971c2' : '#dee2e6'}`,
                borderRadius: 3,
                cursor: 'pointer',
                transition: 'background-color 0.05s',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// --- Photo tab state ---

interface PhotoGroupState {
  id: string;
  label: string;
  cells: boolean[][];
}

// --- Main page ---

export default function BracketCalculatorPage() {
  // Shared state
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loadingPanels, setLoadingPanels] = useState(false);

  // Manual tab state
  const [groups, setGroups] = useState<GroupState[]>(() => {
    groupCounter = 0;
    return [createGroup()];
  });
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<MountingMultiResult | null>(null);

  // Photo tab state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [photoGroups, setPhotoGroups] = useState<PhotoGroupState[] | null>(null);
  const [photoMountingType, setPhotoMountingType] = useState('ibr');
  const [photoTiltRoofType, setPhotoTiltRoofType] = useState('ibr');
  const [photoPanelSource, setPhotoPanelSource] = useState<'database' | 'manual'>('database');
  const [photoPanelId, setPhotoPanelId] = useState<string | null>(null);
  const [photoWidthMm, setPhotoWidthMm] = useState<number | ''>(1134);
  const [photoCalculating, setPhotoCalculating] = useState(false);
  const [photoResult, setPhotoResult] = useState<MountingMultiResult | null>(null);

  useEffect(() => {
    setLoadingPanels(true);
    getPanels('approved')
      .then((data: Panel[]) => setPanels(data))
      .catch(() => notifications.show({ title: 'Error', message: 'Failed to load panels', color: 'red' }))
      .finally(() => setLoadingPanels(false));
  }, []);

  // --- Manual tab handlers ---

  const updateGroup = useCallback((id: string, patch: Partial<GroupState>) => {
    setGroups((prev) => prev.map((g) => g.id === id ? { ...g, ...patch } : g));
    setResult(null);
  }, []);

  const addGroup = () => {
    setGroups((prev) => [...prev, createGroup()]);
    setResult(null);
  };

  const duplicateGroup = (id: string) => {
    setGroups((prev) => {
      const source = prev.find((g) => g.id === id);
      if (!source) return prev;
      const copy = createGroup({
        mountingType: source.mountingType,
        tiltRoofType: source.tiltRoofType,
        panelSource: source.panelSource,
        panelId: source.panelId,
        widthMm: source.widthMm,
        rows: source.rows,
        cols: source.cols,
      });
      const idx = prev.findIndex((g) => g.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    setResult(null);
  };

  const removeGroup = (id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    setResult(null);
  };

  const totalPanels = groups.reduce((sum, g) => {
    const r = typeof g.rows === 'number' ? g.rows : 0;
    const c = typeof g.cols === 'number' ? g.cols : 0;
    return sum + r * c;
  }, 0);

  const handleCalculate = async () => {
    for (const g of groups) {
      if (typeof g.rows !== 'number' || typeof g.cols !== 'number' || g.rows < 1 || g.cols < 1) {
        notifications.show({ title: 'Validation', message: `[${g.label}] Rows and columns must be at least 1`, color: 'orange' });
        return;
      }
      if (g.panelSource === 'database' && !g.panelId) {
        notifications.show({ title: 'Validation', message: `[${g.label}] Select a panel from the database`, color: 'orange' });
        return;
      }
      if (g.panelSource === 'manual' && (typeof g.widthMm !== 'number' || g.widthMm < 100)) {
        notifications.show({ title: 'Validation', message: `[${g.label}] Enter a valid panel width (mm)`, color: 'orange' });
        return;
      }
    }

    setCalculating(true);
    setResult(null);

    try {
      const apiGroups: MountingGroupInput[] = groups.map((g) => {
        const resolvedType = g.mountingType === 'tilt_frame'
          ? `tilt_frame_${g.tiltRoofType}` as any
          : g.mountingType as any;

        const base: MountingGroupInput = {
          label: g.label,
          mounting_type: resolvedType,
          rows: g.rows as number,
          cols: g.cols as number,
        };

        if (g.panelSource === 'database') {
          base.panel_id = Number(g.panelId);
        } else {
          base.width_mm = g.widthMm as number;
        }

        return base;
      });

      const data = await calculateMountingMulti(apiGroups);
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

  // --- Photo tab handlers ---

  const handleAnalyzePhoto = async () => {
    if (!photoFile) {
      notifications.show({ title: 'Validation', message: 'Select a photo first', color: 'orange' });
      return;
    }

    setAnalyzing(true);
    setPhotoGroups(null);
    setPhotoResult(null);

    try {
      const data = await analyzePhoto(photoFile);
      if (data.groups.length === 0) {
        notifications.show({ title: 'No Panels Detected', message: 'No solar panel arrays were detected in the photo. Try a clearer aerial image.', color: 'orange' });
        setPhotoGroups([]);
      } else {
        setPhotoGroups(data.groups.map((g) => ({
          id: crypto.randomUUID(),
          label: g.label,
          cells: gridFromRowCounts(g.rows),
        })));
      }
    } catch (err: any) {
      notifications.show({
        title: 'Analysis Failed',
        message: err.response?.data?.error || 'Failed to analyze photo',
        color: 'red',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const updatePhotoGroup = (id: string, patch: Partial<PhotoGroupState>) => {
    setPhotoGroups((prev) => prev ? prev.map((g) => g.id === id ? { ...g, ...patch } : g) : prev);
    setPhotoResult(null);
  };

  const addPhotoGroup = () => {
    setPhotoGroups((prev) => [
      ...(prev || []),
      { id: crypto.randomUUID(), label: `Array ${(prev?.length || 0) + 1}`, cells: createEmptyGrid() },
    ]);
    setPhotoResult(null);
  };

  const removePhotoGroup = (id: string) => {
    setPhotoGroups((prev) => prev ? prev.filter((g) => g.id !== id) : prev);
    setPhotoResult(null);
  };

  const photoTotalPanels = photoGroups
    ? photoGroups.reduce((sum, g) => sum + countGridPanels(g.cells), 0)
    : 0;

  const handlePhotoCalculate = async () => {
    if (!photoGroups || photoGroups.length === 0) return;

    if (photoPanelSource === 'database' && !photoPanelId) {
      notifications.show({ title: 'Validation', message: 'Select a panel from the database', color: 'orange' });
      return;
    }
    if (photoPanelSource === 'manual' && (typeof photoWidthMm !== 'number' || photoWidthMm < 100)) {
      notifications.show({ title: 'Validation', message: 'Enter a valid panel width (mm)', color: 'orange' });
      return;
    }

    const resolvedType = photoMountingType === 'tilt_frame'
      ? `tilt_frame_${photoTiltRoofType}` as any
      : photoMountingType as any;

    setPhotoCalculating(true);
    setPhotoResult(null);

    try {
      // Extract row_counts from each grid (panels per row, skip empty rows)
      const apiGroups: IrregularGroupInput[] = photoGroups
        .filter((g) => countGridPanels(g.cells) > 0)
        .map((g) => {
          const rowCounts = g.cells
            .map((row) => row.filter(Boolean).length)
            .filter((count) => count > 0);
          const base: IrregularGroupInput = {
            label: g.label,
            mounting_type: resolvedType,
            row_counts: rowCounts,
          };
          if (photoPanelSource === 'database') {
            base.panel_id = Number(photoPanelId);
          } else {
            base.width_mm = photoWidthMm as number;
          }
          return base;
        });

      if (apiGroups.length === 0) {
        notifications.show({ title: 'Validation', message: 'No panels selected on any grid', color: 'orange' });
        setPhotoCalculating(false);
        return;
      }

      const data = await calculateMountingIrregular(apiGroups);
      setPhotoResult(data);
    } catch (err: any) {
      notifications.show({
        title: 'Calculation Failed',
        message: err.response?.data?.error || 'Unexpected error',
        color: 'red',
      });
    } finally {
      setPhotoCalculating(false);
    }
  };

  return (
    <Stack gap="lg">
      <Title order={2}>Bracket Calculator</Title>

      <Tabs defaultValue="manual">
        <Tabs.List>
          <Tabs.Tab value="manual" leftSection={<IconCalculator size={16} />}>Manual</Tabs.Tab>
          <Tabs.Tab value="photo" leftSection={<IconPhoto size={16} />}>From Photo</Tabs.Tab>
        </Tabs.List>

        {/* ===== MANUAL TAB ===== */}
        <Tabs.Panel value="manual" pt="md">
          <Stack gap="lg">
            {groups.map((g) => {
              const panelQty = (typeof g.rows === 'number' && typeof g.cols === 'number')
                ? g.rows * g.cols : 0;

              return (
                <Card key={g.id} shadow="sm" padding="lg" radius="md" withBorder>
                  <Stack gap="md">
                    <Group justify="space-between">
                      <TextInput
                        value={g.label}
                        onChange={(e) => updateGroup(g.id, { label: e.currentTarget.value })}
                        variant="unstyled"
                        styles={{ input: { fontWeight: 600, fontSize: '1.1rem' } }}
                        style={{ flex: 1 }}
                      />
                      <Group gap="xs">
                        <ActionIcon
                          variant="light"
                          color="blue"
                          title="Duplicate array"
                          onClick={() => duplicateGroup(g.id)}
                        >
                          <IconCopy size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="light"
                          color="red"
                          title="Remove array"
                          onClick={() => removeGroup(g.id)}
                          disabled={groups.length <= 1}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Group>

                    <Text fw={500}>Mounting Type</Text>
                    <SegmentedControl
                      value={g.mountingType}
                      onChange={(v) => updateGroup(g.id, { mountingType: v })}
                      data={[
                        { label: 'IBR Roof', value: 'ibr' },
                        { label: 'Corrugated Roof', value: 'corrugated' },
                        { label: 'Tile Roof', value: 'tile' },
                        { label: 'Tilt Frame', value: 'tilt_frame' },
                      ]}
                    />

                    {g.mountingType === 'tilt_frame' && (
                      <>
                        <Text fw={500}>Tilt Frame Roof Type</Text>
                        <SegmentedControl
                          value={g.tiltRoofType}
                          onChange={(v) => updateGroup(g.id, { tiltRoofType: v })}
                          data={[
                            { label: 'IBR', value: 'ibr' },
                            { label: 'Corrugated', value: 'corrugated' },
                          ]}
                        />
                      </>
                    )}

                    <Text fw={500}>Panel Source</Text>
                    <SegmentedControl
                      value={g.panelSource}
                      onChange={(v) => updateGroup(g.id, { panelSource: v as 'database' | 'manual' })}
                      data={[
                        { label: 'Database', value: 'database' },
                        { label: 'Manual', value: 'manual' },
                      ]}
                    />

                    {g.panelSource === 'database' ? (
                      <Select
                        label="Panel"
                        placeholder={loadingPanels ? 'Loading panels...' : 'Select approved panel'}
                        searchable
                        data={panels.map((p) => ({
                          value: String(p.id),
                          label: `${p.name} (${p.power_w}W)`,
                        }))}
                        value={g.panelId}
                        onChange={(v) => updateGroup(g.id, { panelId: v })}
                        rightSection={loadingPanels ? <Loader size={16} /> : undefined}
                      />
                    ) : (
                      <NumberInput
                        label="Panel Width (mm)"
                        value={g.widthMm}
                        onChange={(v) => updateGroup(g.id, { widthMm: v as number | '' })}
                        min={100}
                        max={3000}
                        step={1}
                      />
                    )}

                    <Group grow>
                      <NumberInput
                        label="Rows"
                        value={g.rows}
                        onChange={(v) => updateGroup(g.id, { rows: v as number | '' })}
                        min={1}
                        max={50}
                      />
                      <NumberInput
                        label="Columns"
                        value={g.cols}
                        onChange={(v) => updateGroup(g.id, { cols: v as number | '' })}
                        min={1}
                        max={50}
                      />
                    </Group>

                    <Text size="sm" c="dimmed">
                      Panel qty: {typeof g.rows === 'number' ? g.rows : '?'} x {typeof g.cols === 'number' ? g.cols : '?'} = {panelQty}
                    </Text>
                  </Stack>
                </Card>
              );
            })}

            <Button
              variant="light"
              leftSection={<IconPlus size={16} />}
              onClick={addGroup}
              disabled={groups.length >= 10}
            >
              Add Array
            </Button>

            <Group justify="space-between" align="center">
              <Text fw={500}>
                Total: {totalPanels} panel{totalPanels !== 1 ? 's' : ''} across {groups.length} array{groups.length !== 1 ? 's' : ''}
              </Text>
              <Button
                leftSection={<IconCalculator size={18} />}
                onClick={handleCalculate}
                loading={calculating}
                size="md"
              >
                Calculate
              </Button>
            </Group>

            {result && <MountingResults result={result} />}
          </Stack>
        </Tabs.Panel>

        {/* ===== FROM PHOTO TAB ===== */}
        <Tabs.Panel value="photo" pt="md">
          <Stack gap="lg">
            {/* Upload section */}
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Stack gap="md">
                <Title order={4}>Upload Roof Photo</Title>
                <Text size="sm" c="dimmed">
                  Upload an aerial or roof photo showing solar panels. AI will detect panel arrays and count rows/columns.
                </Text>
                <Group align="end">
                  <FileInput
                    label="Photo"
                    placeholder="Select image..."
                    accept="image/png,image/jpeg"
                    value={photoFile}
                    onChange={(f) => { setPhotoFile(f); setPhotoGroups(null); setPhotoResult(null); }}
                    leftSection={<IconPhoto size={16} />}
                    style={{ flex: 1 }}
                  />
                  <Button
                    leftSection={<IconUpload size={16} />}
                    onClick={handleAnalyzePhoto}
                    loading={analyzing}
                    disabled={!photoFile}
                  >
                    {analyzing ? 'Analyzing photo with AI...' : 'Analyze'}
                  </Button>
                </Group>
              </Stack>
            </Card>

            {/* Detected groups (editable) */}
            {photoGroups !== null && (
              <>
                {photoGroups.length === 0 ? (
                  <Alert color="orange" icon={<IconInfoCircle size={18} />}>
                    No solar panel arrays were detected. You can add groups manually below.
                  </Alert>
                ) : (
                  <Alert color="blue" icon={<IconInfoCircle size={18} />}>
                    Detected {photoTotalPanels} panel{photoTotalPanels !== 1 ? 's' : ''} across {photoGroups.length} array{photoGroups.length !== 1 ? 's' : ''}. Edit below if needed.
                  </Alert>
                )}

                {photoGroups.map((g) => {
                  const groupPanels = countGridPanels(g.cells);
                  const activeRows = getGridActiveRows(g.cells);
                  const maxCols = getGridMaxCols(g.cells);

                  return (
                    <Card key={g.id} shadow="xs" padding="md" radius="md" withBorder>
                      <Stack gap="sm">
                        <Group justify="space-between">
                          <TextInput
                            value={g.label}
                            onChange={(e) => updatePhotoGroup(g.id, { label: e.currentTarget.value })}
                            variant="unstyled"
                            styles={{ input: { fontWeight: 600, fontSize: '1rem' } }}
                            style={{ flex: 1 }}
                          />
                          <Group gap="xs">
                            <Badge variant="light" size="sm">
                              {groupPanels} panel{groupPanels !== 1 ? 's' : ''}
                            </Badge>
                            <Badge variant="light" color="gray" size="sm">
                              {activeRows}R x {maxCols}C
                            </Badge>
                            <ActionIcon
                              variant="light"
                              color="red"
                              title="Remove array"
                              onClick={() => removePhotoGroup(g.id)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                        </Group>

                        <Text size="xs" c="dimmed">Click or drag to toggle panels:</Text>

                        <PanelGrid
                          cells={g.cells}
                          onChange={(cells) => updatePhotoGroup(g.id, { cells })}
                        />
                      </Stack>
                    </Card>
                  );
                })}

                <Button
                  variant="light"
                  leftSection={<IconPlus size={16} />}
                  onClick={addPhotoGroup}
                  disabled={photoGroups.length >= 10}
                  size="sm"
                >
                  Add Group
                </Button>

                {/* Mounting config */}
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                  <Stack gap="md">
                    <Title order={4}>Mounting Configuration</Title>

                    <Text fw={500}>Mounting Type</Text>
                    <SegmentedControl
                      value={photoMountingType}
                      onChange={setPhotoMountingType}
                      data={[
                        { label: 'IBR Roof', value: 'ibr' },
                        { label: 'Corrugated Roof', value: 'corrugated' },
                        { label: 'Tile Roof', value: 'tile' },
                        { label: 'Tilt Frame', value: 'tilt_frame' },
                      ]}
                    />

                    {photoMountingType === 'tilt_frame' && (
                      <>
                        <Text fw={500}>Tilt Frame Roof Type</Text>
                        <SegmentedControl
                          value={photoTiltRoofType}
                          onChange={setPhotoTiltRoofType}
                          data={[
                            { label: 'IBR', value: 'ibr' },
                            { label: 'Corrugated', value: 'corrugated' },
                          ]}
                        />
                      </>
                    )}

                    <Text fw={500}>Panel Source</Text>
                    <SegmentedControl
                      value={photoPanelSource}
                      onChange={(v) => setPhotoPanelSource(v as 'database' | 'manual')}
                      data={[
                        { label: 'Database', value: 'database' },
                        { label: 'Manual', value: 'manual' },
                      ]}
                    />

                    {photoPanelSource === 'database' ? (
                      <Select
                        label="Panel"
                        placeholder={loadingPanels ? 'Loading panels...' : 'Select approved panel'}
                        searchable
                        data={panels.map((p) => ({
                          value: String(p.id),
                          label: `${p.name} (${p.power_w}W)`,
                        }))}
                        value={photoPanelId}
                        onChange={setPhotoPanelId}
                        rightSection={loadingPanels ? <Loader size={16} /> : undefined}
                      />
                    ) : (
                      <NumberInput
                        label="Panel Width (mm)"
                        value={photoWidthMm}
                        onChange={(v) => setPhotoWidthMm(v as number | '')}
                        min={100}
                        max={3000}
                        step={1}
                      />
                    )}
                  </Stack>
                </Card>

                {/* Calculate */}
                <Group justify="space-between" align="center">
                  <Text fw={500}>
                    Total: {photoTotalPanels} panel{photoTotalPanels !== 1 ? 's' : ''} across {photoGroups.length} array{photoGroups.length !== 1 ? 's' : ''}
                  </Text>
                  <Button
                    leftSection={<IconCalculator size={18} />}
                    onClick={handlePhotoCalculate}
                    loading={photoCalculating}
                    disabled={photoGroups.length === 0}
                    size="md"
                  >
                    Calculate
                  </Button>
                </Group>

                {photoResult && <MountingResults result={photoResult} />}
              </>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
