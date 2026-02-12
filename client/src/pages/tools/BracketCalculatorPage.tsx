import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card, Title, Stack, SegmentedControl, Select, NumberInput,
  Button, Table, Alert, Text, Group, Loader, ActionIcon,
  TextInput, Accordion, Badge,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCalculator, IconAlertTriangle, IconInfoCircle,
  IconPlus, IconCopy, IconTrash,
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
const GRID_COLS = 10;

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

function getGridMaxCols(cells: boolean[][]): number {
  return cells.reduce((max, row) => Math.max(max, row.filter(Boolean).length), 0);
}

// --- Orientation type ---
type Orientation = 'portrait' | 'landscape';

// Portrait = tile (rails), Landscape = IBR/corrugated (direct brackets)
// Tilt frame is separate (uses rows x cols, no grid)

interface GroupState {
  id: string;
  label: string;
  mode: 'roof' | 'tilt_frame';
  orientation: Orientation;      // for roof mode
  roofSubType: 'ibr' | 'corrugated'; // for landscape roof
  tiltRoofType: 'ibr' | 'corrugated'; // for tilt frame
  panelSource: 'database' | 'manual';
  panelId: string | null;
  widthMm: number | '';
  cells: boolean[][];            // grid for roof mode
  tiltRows: number | '';         // for tilt frame mode
  tiltCols: number | '';         // for tilt frame mode
}

let groupCounter = 0;
function createGroup(overrides?: Partial<GroupState>): GroupState {
  groupCounter++;
  return {
    id: crypto.randomUUID(),
    label: `Array ${groupCounter}`,
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

// Portrait panel: tall rectangle. Landscape panel: wide rectangle.
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
                // Inner lines to look like a solar panel cell pattern
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

// --- Main page ---

export default function BracketCalculatorPage() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loadingPanels, setLoadingPanels] = useState(false);
  const [groups, setGroups] = useState<GroupState[]>(() => {
    groupCounter = 0;
    return [createGroup()];
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
    if (g.mode === 'tilt_frame') {
      const r = typeof g.tiltRows === 'number' ? g.tiltRows : 0;
      const c = typeof g.tiltCols === 'number' ? g.tiltCols : 0;
      return sum + r * c;
    }
    return sum + countGridPanels(g.cells);
  }, 0);

  const handleCalculate = async () => {
    // Validate all groups
    for (const g of groups) {
      if (g.mode === 'tilt_frame') {
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
      const apiGroups: IrregularGroupInput[] = groups.map((g) => {
        let mountingType: string;
        let rowCounts: number[];

        if (g.mode === 'tilt_frame') {
          mountingType = `tilt_frame_${g.tiltRoofType}`;
          // Tilt frame: rectangular grid, just repeat cols for each row
          const rows = g.tiltRows as number;
          const cols = g.tiltCols as number;
          rowCounts = Array(rows).fill(cols);
        } else if (g.orientation === 'portrait') {
          mountingType = 'tile';
          rowCounts = getGridRowCounts(g.cells);
        } else {
          // landscape = IBR or corrugated
          mountingType = g.roofSubType;
          rowCounts = getGridRowCounts(g.cells);
        }

        const base: IrregularGroupInput = {
          label: g.label,
          mounting_type: mountingType as any,
          row_counts: rowCounts,
        };

        if (g.panelSource === 'database') {
          base.panel_id = Number(g.panelId);
        } else {
          base.width_mm = g.widthMm as number;
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

      {groups.map((g) => {
        const panelCount = g.mode === 'tilt_frame'
          ? (typeof g.tiltRows === 'number' ? g.tiltRows : 0) * (typeof g.tiltCols === 'number' ? g.tiltCols : 0)
          : countGridPanels(g.cells);
        const activeRows = g.mode === 'roof' ? getGridActiveRows(g.cells) : 0;
        const maxCols = g.mode === 'roof' ? getGridMaxCols(g.cells) : 0;

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
                  {g.mode === 'roof' && panelCount > 0 && (
                    <Badge variant="light" color="gray" size="sm">
                      {activeRows}R x {maxCols}C
                    </Badge>
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

              {/* Mode: Roof vs Tilt Frame */}
              <Text fw={500}>Installation Type</Text>
              <SegmentedControl
                value={g.mode}
                onChange={(v) => updateGroup(g.id, { mode: v as 'roof' | 'tilt_frame' })}
                data={[
                  { label: 'Roof Mount', value: 'roof' },
                  { label: 'Tilt Frame (Flat Roof)', value: 'tilt_frame' },
                ]}
              />

              {g.mode === 'roof' && (
                <>
                  {/* Orientation: Portrait (tile/rails) vs Landscape (IBR) */}
                  <Text fw={500}>Panel Orientation</Text>
                  <SegmentedControl
                    value={g.orientation}
                    onChange={(v) => updateGroup(g.id, { orientation: v as Orientation })}
                    data={[
                      { label: 'Landscape (IBR / Corrugated)', value: 'landscape' },
                      { label: 'Portrait (Tile / Rails)', value: 'portrait' },
                    ]}
                  />

                  {/* Sub-type for landscape: IBR vs Corrugated */}
                  {g.orientation === 'landscape' && (
                    <>
                      <Text fw={500}>Roof Type</Text>
                      <SegmentedControl
                        value={g.roofSubType}
                        onChange={(v) => updateGroup(g.id, { roofSubType: v as 'ibr' | 'corrugated' })}
                        data={[
                          { label: 'IBR', value: 'ibr' },
                          { label: 'Corrugated', value: 'corrugated' },
                        ]}
                      />
                    </>
                  )}

                  {/* Panel grid */}
                  <Text size="xs" c="dimmed">Click or drag to toggle panels:</Text>
                  <PanelGrid
                    cells={g.cells}
                    orientation={g.orientation}
                    onChange={(cells) => updateGroup(g.id, { cells })}
                  />
                </>
              )}

              {g.mode === 'tilt_frame' && (
                <>
                  <Text fw={500}>Roof Type</Text>
                  <SegmentedControl
                    value={g.tiltRoofType}
                    onChange={(v) => updateGroup(g.id, { tiltRoofType: v as 'ibr' | 'corrugated' })}
                    data={[
                      { label: 'IBR', value: 'ibr' },
                      { label: 'Corrugated', value: 'corrugated' },
                    ]}
                  />

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
                </>
              )}

              {/* Panel source */}
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
  );
}
