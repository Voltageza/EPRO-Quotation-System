import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card, Title, Stack, SegmentedControl, Select, NumberInput,
  Button, Table, Alert, Text, Group, Loader, ActionIcon,
  TextInput, Accordion, Badge, Switch,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCalculator, IconAlertTriangle, IconInfoCircle,
  IconPlus, IconCopy, IconTrash, IconSettings,
} from '@tabler/icons-react';
import { getPanels } from '../../api/panels.api';
import {
  calculateMountingIrregular,
  MountingMultiResult,
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

// --- Grid helpers ---

const GRID_ROWS = 10;
const GRID_COLS = 15;

function createEmptyGrid(): boolean[][] {
  return Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(false));
}

function countGridPanels(cells: boolean[][]): number {
  return cells.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
}

function getGridRowCounts(cells: boolean[][]): number[] {
  return cells
    .map((row) => row.filter(Boolean).length)
    .filter((count) => count > 0);
}

function getGridActiveRows(cells: boolean[][]): number {
  return cells.filter((row) => row.some(Boolean)).length;
}

/** Get the total column span (rightmost - leftmost + 1) across all rows */
function getGridColSpan(cells: boolean[][]): number {
  let minCol = GRID_COLS;
  let maxCol = -1;
  for (const row of cells) {
    for (let c = 0; c < row.length; c++) {
      if (row[c]) {
        if (c < minCol) minCol = c;
        if (c > maxCol) maxCol = c;
      }
    }
  }
  return maxCol >= 0 ? maxCol - minCol + 1 : 0;
}

/** Get active column indices per active row (for position-aware calculation) */
function getGridRowColumns(cells: boolean[][]): number[][] {
  return cells
    .filter((row) => row.some(Boolean))
    .map((row) => {
      const cols: number[] = [];
      for (let c = 0; c < row.length; c++) {
        if (row[c]) cols.push(c);
      }
      return cols;
    });
}

// --- Orientation type ---
type Orientation = 'portrait' | 'landscape';

// --- Global settings (shared across arrays) ---
interface GlobalSettings {
  mode: 'roof' | 'tilt_frame';
  orientation: Orientation;
  roofSubType: 'ibr' | 'corrugated';
  tiltRoofType: 'ibr' | 'corrugated';
  panelSource: 'database' | 'manual';
  panelId: string | null;
  widthMm: number | '';
}

const defaultGlobalSettings: GlobalSettings = {
  mode: 'roof',
  orientation: 'landscape',
  roofSubType: 'ibr',
  tiltRoofType: 'ibr',
  panelSource: 'database',
  panelId: null,
  widthMm: 1134,
};

interface GroupState {
  id: string;
  label: string;
  useCustomSettings: boolean;
  // Per-array overrides (used only when useCustomSettings is true)
  mode: 'roof' | 'tilt_frame';
  orientation: Orientation;
  roofSubType: 'ibr' | 'corrugated';
  tiltRoofType: 'ibr' | 'corrugated';
  panelSource: 'database' | 'manual';
  panelId: string | null;
  widthMm: number | '';
  cells: boolean[][];
  tiltRows: number | '';
  tiltCols: number | '';
}

/** Resolve effective settings for a group */
function resolveSettings(g: GroupState, global: GlobalSettings) {
  if (g.useCustomSettings) {
    return {
      mode: g.mode,
      orientation: g.orientation,
      roofSubType: g.roofSubType,
      tiltRoofType: g.tiltRoofType,
      panelSource: g.panelSource,
      panelId: g.panelId,
      widthMm: g.widthMm,
    };
  }
  return { ...global };
}

function nextGroupNumber(existing: GroupState[]): number {
  const used = new Set(
    existing.map((g) => {
      const m = g.label.match(/^Array (\d+)$/);
      return m ? Number(m[1]) : 0;
    }),
  );
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

function createGroup(existing: GroupState[], overrides?: Partial<GroupState>): GroupState {
  const num = nextGroupNumber(existing);
  return {
    id: crypto.randomUUID(),
    label: `Array ${num}`,
    useCustomSettings: false,
    mode: 'roof',
    orientation: 'landscape',
    roofSubType: 'ibr',
    tiltRoofType: 'ibr',
    panelSource: 'database',
    panelId: null,
    widthMm: 1134,
    cells: createEmptyGrid(),
    tiltRows: 2,
    tiltCols: 6,
    ...overrides,
  };
}

// --- Shared result components ---

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

// --- Panel grid with solar-panel-shaped cells ---

const CELL_PORTRAIT = { w: 24, h: 40 };
const CELL_LANDSCAPE = { w: 40, h: 24 };
const CELL_GAP = 2;

function PanelGrid({
  cells,
  orientation,
  onChange,
}: {
  cells: boolean[][];
  orientation: Orientation;
  onChange: (cells: boolean[][]) => void;
}) {
  const draggingRef = useRef(false);
  const targetRef = useRef(false);
  const cellsRef = useRef(cells);
  cellsRef.current = cells;

  const cellSize = orientation === 'portrait' ? CELL_PORTRAIT : CELL_LANDSCAPE;

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
      <div style={{ display: 'flex', gap: CELL_GAP, marginLeft: 28, marginBottom: 2 }}>
        {Array.from({ length: GRID_COLS }, (_, c) => (
          <div key={c} style={{ width: cellSize.w, textAlign: 'center', fontSize: 10, color: '#868e96' }}>{c + 1}</div>
        ))}
      </div>
      {cells.map((row, r) => (
        <div key={r} style={{ display: 'flex', gap: CELL_GAP, alignItems: 'center', marginBottom: CELL_GAP }}>
          <div style={{ width: 24, fontSize: 10, color: '#868e96', textAlign: 'right', marginRight: 2 }}>{r + 1}</div>
          {row.map((active, c) => (
            <div
              key={c}
              onMouseDown={(e) => { e.preventDefault(); handleMouseDown(r, c); }}
              onMouseEnter={() => handleMouseEnter(r, c)}
              style={{
                width: cellSize.w,
                height: cellSize.h,
                backgroundColor: active ? '#228be6' : '#f1f3f5',
                border: `1px solid ${active ? '#1971c2' : '#dee2e6'}`,
                borderRadius: 3,
                cursor: 'pointer',
                transition: 'background-color 0.05s',
                ...(active ? {
                  backgroundImage: orientation === 'portrait'
                    ? 'linear-gradient(0deg, transparent 24%, rgba(255,255,255,0.15) 25%, rgba(255,255,255,0.15) 26%, transparent 27%),linear-gradient(0deg, transparent 49%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 51%, transparent 52%),linear-gradient(0deg, transparent 74%, rgba(255,255,255,0.15) 75%, rgba(255,255,255,0.15) 76%, transparent 77%)'
                    : 'linear-gradient(90deg, transparent 24%, rgba(255,255,255,0.15) 25%, rgba(255,255,255,0.15) 26%, transparent 27%),linear-gradient(90deg, transparent 49%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 51%, transparent 52%),linear-gradient(90deg, transparent 74%, rgba(255,255,255,0.15) 75%, rgba(255,255,255,0.15) 76%, transparent 77%)',
                } : {}),
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// --- Mounting settings controls (reused for global + per-array) ---

function MountingSettingsControls({
  mode, orientation, roofSubType, tiltRoofType, panelSource, panelId, widthMm,
  panels, loadingPanels,
  onMode, onOrientation, onRoofSubType, onTiltRoofType,
  onPanelSource, onPanelId, onWidthMm,
}: {
  mode: 'roof' | 'tilt_frame';
  orientation: Orientation;
  roofSubType: 'ibr' | 'corrugated';
  tiltRoofType: 'ibr' | 'corrugated';
  panelSource: 'database' | 'manual';
  panelId: string | null;
  widthMm: number | '';
  panels: Panel[];
  loadingPanels: boolean;
  onMode: (v: 'roof' | 'tilt_frame') => void;
  onOrientation: (v: Orientation) => void;
  onRoofSubType: (v: 'ibr' | 'corrugated') => void;
  onTiltRoofType: (v: 'ibr' | 'corrugated') => void;
  onPanelSource: (v: 'database' | 'manual') => void;
  onPanelId: (v: string | null) => void;
  onWidthMm: (v: number | '') => void;
}) {
  return (
    <>
      <Text fw={500}>Installation Type</Text>
      <SegmentedControl
        value={mode}
        onChange={(v) => onMode(v as 'roof' | 'tilt_frame')}
        data={[
          { label: 'Roof Mount', value: 'roof' },
          { label: 'Tilt Frame (Flat Roof)', value: 'tilt_frame' },
        ]}
      />

      {mode === 'roof' && (
        <>
          <Text fw={500}>Panel Orientation</Text>
          <SegmentedControl
            value={orientation}
            onChange={(v) => onOrientation(v as Orientation)}
            data={[
              { label: 'Landscape (IBR / Corrugated)', value: 'landscape' },
              { label: 'Portrait (Tile / Rails)', value: 'portrait' },
            ]}
          />

          {orientation === 'landscape' && (
            <>
              <Text fw={500}>Roof Type</Text>
              <SegmentedControl
                value={roofSubType}
                onChange={(v) => onRoofSubType(v as 'ibr' | 'corrugated')}
                data={[
                  { label: 'IBR', value: 'ibr' },
                  { label: 'Corrugated', value: 'corrugated' },
                ]}
              />
            </>
          )}
        </>
      )}

      {mode === 'tilt_frame' && (
        <>
          <Text fw={500}>Roof Type</Text>
          <SegmentedControl
            value={tiltRoofType}
            onChange={(v) => onTiltRoofType(v as 'ibr' | 'corrugated')}
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
        onChange={(v) => onPanelSource(v as 'database' | 'manual')}
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
          onChange={(v) => onPanelId(v)}
          rightSection={loadingPanels ? <Loader size={16} /> : undefined}
        />
      ) : (
        <NumberInput
          label="Panel Width (mm)"
          value={widthMm}
          onChange={(v) => onWidthMm(v as number | '')}
          min={100}
          max={3000}
          step={1}
        />
      )}
    </>
  );
}

// --- Main page ---

export default function BracketCalculatorPage() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loadingPanels, setLoadingPanels] = useState(false);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({ ...defaultGlobalSettings });
  const [groups, setGroups] = useState<GroupState[]>(() => {
    return [createGroup([])];
  });
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<MountingMultiResult | null>(null);

  useEffect(() => {
    setLoadingPanels(true);
    getPanels('approved')
      .then((data: Panel[]) => setPanels(data))
      .catch(() => notifications.show({ title: 'Error', message: 'Failed to load panels', color: 'red' }))
      .finally(() => setLoadingPanels(false));
  }, []);

  const updateGlobal = useCallback((patch: Partial<GlobalSettings>) => {
    setGlobalSettings((prev) => ({ ...prev, ...patch }));
    setResult(null);
  }, []);

  const updateGroup = useCallback((id: string, patch: Partial<GroupState>) => {
    setGroups((prev) => prev.map((g) => g.id === id ? { ...g, ...patch } : g));
    setResult(null);
  }, []);

  const addGroup = () => {
    setGroups((prev) => [...prev, createGroup(prev)]);
    setResult(null);
  };

  const duplicateGroup = (id: string) => {
    setGroups((prev) => {
      const source = prev.find((g) => g.id === id);
      if (!source) return prev;
      const copy = createGroup(prev, {
        useCustomSettings: source.useCustomSettings,
        mode: source.mode,
        orientation: source.orientation,
        roofSubType: source.roofSubType,
        tiltRoofType: source.tiltRoofType,
        panelSource: source.panelSource,
        panelId: source.panelId,
        widthMm: source.widthMm,
        cells: source.cells.map((row) => [...row]),
        tiltRows: source.tiltRows,
        tiltCols: source.tiltCols,
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
    const eff = resolveSettings(g, globalSettings);
    if (eff.mode === 'tilt_frame') {
      const r = typeof g.tiltRows === 'number' ? g.tiltRows : 0;
      const c = typeof g.tiltCols === 'number' ? g.tiltCols : 0;
      return sum + r * c;
    }
    return sum + countGridPanels(g.cells);
  }, 0);

  const handleCalculate = async () => {
    // Validate all groups
    for (const g of groups) {
      const eff = resolveSettings(g, globalSettings);

      if (eff.mode === 'tilt_frame') {
        if (typeof g.tiltRows !== 'number' || typeof g.tiltCols !== 'number' || g.tiltRows < 1 || g.tiltCols < 1) {
          notifications.show({ title: 'Validation', message: `[${g.label}] Rows and columns must be at least 1`, color: 'orange' });
          return;
        }
      } else {
        if (countGridPanels(g.cells) === 0) {
          notifications.show({ title: 'Validation', message: `[${g.label}] Select at least one panel on the grid`, color: 'orange' });
          return;
        }
      }
      if (eff.panelSource === 'database' && !eff.panelId) {
        notifications.show({ title: 'Validation', message: `[${g.label}] Select a panel from the database`, color: 'orange' });
        return;
      }
      if (eff.panelSource === 'manual' && (typeof eff.widthMm !== 'number' || eff.widthMm < 100)) {
        notifications.show({ title: 'Validation', message: `[${g.label}] Enter a valid panel width (mm)`, color: 'orange' });
        return;
      }
    }

    setCalculating(true);
    setResult(null);

    try {
      const apiGroups: IrregularGroupInput[] = groups.map((g) => {
        const eff = resolveSettings(g, globalSettings);
        let mountingType: string;
        let rowCounts: number[];

        if (eff.mode === 'tilt_frame') {
          mountingType = `tilt_frame_${eff.tiltRoofType}`;
          const rows = g.tiltRows as number;
          const cols = g.tiltCols as number;
          rowCounts = Array(rows).fill(cols);
        } else if (eff.orientation === 'portrait') {
          mountingType = 'tile';
          rowCounts = getGridRowCounts(g.cells);
        } else {
          mountingType = eff.roofSubType;
          rowCounts = getGridRowCounts(g.cells);
        }

        const base: IrregularGroupInput = {
          label: g.label,
          mounting_type: mountingType as any,
          row_counts: rowCounts,
        };

        // Send column positions for position-aware overlap (roof grid modes)
        if (eff.mode !== 'tilt_frame') {
          base.row_columns = getGridRowColumns(g.cells);
        }

        if (eff.panelSource === 'database') {
          base.panel_id = Number(eff.panelId);
        } else {
          base.width_mm = eff.widthMm as number;
        }

        return base;
      });

      const data = await calculateMountingIrregular(apiGroups);
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

      {/* Global Settings Card */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group gap="sm">
            <IconSettings size={20} />
            <Text fw={600} size="lg">Default Settings</Text>
            <Text size="xs" c="dimmed">(applies to all arrays)</Text>
          </Group>

          <MountingSettingsControls
            mode={globalSettings.mode}
            orientation={globalSettings.orientation}
            roofSubType={globalSettings.roofSubType}
            tiltRoofType={globalSettings.tiltRoofType}
            panelSource={globalSettings.panelSource}
            panelId={globalSettings.panelId}
            widthMm={globalSettings.widthMm}
            panels={panels}
            loadingPanels={loadingPanels}
            onMode={(v) => updateGlobal({ mode: v })}
            onOrientation={(v) => updateGlobal({ orientation: v })}
            onRoofSubType={(v) => updateGlobal({ roofSubType: v })}
            onTiltRoofType={(v) => updateGlobal({ tiltRoofType: v })}
            onPanelSource={(v) => updateGlobal({ panelSource: v })}
            onPanelId={(v) => updateGlobal({ panelId: v })}
            onWidthMm={(v) => updateGlobal({ widthMm: v })}
          />
        </Stack>
      </Card>

      {/* Array Cards */}
      {groups.map((g) => {
        const eff = resolveSettings(g, globalSettings);
        const panelCount = eff.mode === 'tilt_frame'
          ? (typeof g.tiltRows === 'number' ? g.tiltRows : 0) * (typeof g.tiltCols === 'number' ? g.tiltCols : 0)
          : countGridPanels(g.cells);
        const activeRows = eff.mode === 'roof' ? getGridActiveRows(g.cells) : 0;
        const colSpan = eff.mode === 'roof' ? getGridColSpan(g.cells) : 0;

        return (
          <Card key={g.id} shadow="sm" padding="lg" radius="md" withBorder>
            <Stack gap="md">
              {/* Header */}
              <Group justify="space-between">
                <TextInput
                  value={g.label}
                  onChange={(e) => updateGroup(g.id, { label: e.currentTarget.value })}
                  variant="unstyled"
                  styles={{ input: { fontWeight: 600, fontSize: '1.1rem' } }}
                  style={{ flex: 1 }}
                />
                <Group gap="xs">
                  <Badge variant="light" size="sm">
                    {panelCount} panel{panelCount !== 1 ? 's' : ''}
                  </Badge>
                  {eff.mode === 'roof' && panelCount > 0 && (
                    <Badge variant="light" color="gray" size="sm">
                      {activeRows}R x {colSpan}C
                    </Badge>
                  )}
                  {g.useCustomSettings && (
                    <Badge variant="light" color="orange" size="sm">Custom</Badge>
                  )}
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

              {/* Grid / Tilt inputs (always shown) */}
              {eff.mode === 'roof' && (
                <>
                  <Text size="xs" c="dimmed">Click or drag to toggle panels:</Text>
                  <PanelGrid
                    cells={g.cells}
                    orientation={eff.orientation}
                    onChange={(cells) => updateGroup(g.id, { cells })}
                  />
                </>
              )}

              {eff.mode === 'tilt_frame' && (
                <Group grow>
                  <NumberInput
                    label="Rows"
                    value={g.tiltRows}
                    onChange={(v) => updateGroup(g.id, { tiltRows: v as number | '' })}
                    min={1}
                    max={50}
                  />
                  <NumberInput
                    label="Columns"
                    value={g.tiltCols}
                    onChange={(v) => updateGroup(g.id, { tiltCols: v as number | '' })}
                    min={1}
                    max={50}
                  />
                </Group>
              )}

              {/* Custom settings toggle */}
              <Switch
                label="Custom settings for this array"
                checked={g.useCustomSettings}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  if (checked) {
                    // Seed per-array values from current global settings
                    updateGroup(g.id, {
                      useCustomSettings: true,
                      mode: globalSettings.mode,
                      orientation: globalSettings.orientation,
                      roofSubType: globalSettings.roofSubType,
                      tiltRoofType: globalSettings.tiltRoofType,
                      panelSource: globalSettings.panelSource,
                      panelId: globalSettings.panelId,
                      widthMm: globalSettings.widthMm,
                    });
                  } else {
                    updateGroup(g.id, { useCustomSettings: false });
                  }
                }}
                size="sm"
              />

              {/* Per-array overrides (only when custom settings enabled) */}
              {g.useCustomSettings && (
                <Card padding="md" radius="sm" withBorder style={{ backgroundColor: 'var(--mantine-color-orange-0, #fff9db)' }}>
                  <Stack gap="md">
                    <MountingSettingsControls
                      mode={g.mode}
                      orientation={g.orientation}
                      roofSubType={g.roofSubType}
                      tiltRoofType={g.tiltRoofType}
                      panelSource={g.panelSource}
                      panelId={g.panelId}
                      widthMm={g.widthMm}
                      panels={panels}
                      loadingPanels={loadingPanels}
                      onMode={(v) => updateGroup(g.id, { mode: v })}
                      onOrientation={(v) => updateGroup(g.id, { orientation: v })}
                      onRoofSubType={(v) => updateGroup(g.id, { roofSubType: v })}
                      onTiltRoofType={(v) => updateGroup(g.id, { tiltRoofType: v })}
                      onPanelSource={(v) => updateGroup(g.id, { panelSource: v })}
                      onPanelId={(v) => updateGroup(g.id, { panelId: v })}
                      onWidthMm={(v) => updateGroup(g.id, { widthMm: v })}
                    />
                  </Stack>
                </Card>
              )}
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

      <Card shadow="sm" padding="md" radius="md" withBorder>
        <Stack gap="xs">
          <Group justify="space-between" align="center">
            <Text fw={600}>
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
          {groups.map((g) => {
            const eff = resolveSettings(g, globalSettings);
            if (eff.mode === 'tilt_frame') {
              const r = typeof g.tiltRows === 'number' ? g.tiltRows : 0;
              const c = typeof g.tiltCols === 'number' ? g.tiltCols : 0;
              return (
                <Text key={g.id} size="sm" c="dimmed">
                  {g.label}: {r} rows x {c} cols = {r * c} panels (tilt frame)
                </Text>
              );
            }
            const rows = getGridActiveRows(g.cells);
            const colSpan = getGridColSpan(g.cells);
            const count = countGridPanels(g.cells);
            const rowCounts = getGridRowCounts(g.cells);
            return (
              <Text key={g.id} size="sm" c="dimmed">
                {g.label}: {rows} rows x {colSpan} cols = {count} panels [{rowCounts.join(', ')}]
              </Text>
            );
          })}
        </Stack>
      </Card>

      {result && <MountingResults result={result} />}
    </Stack>
  );
}
