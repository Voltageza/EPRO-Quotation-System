import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Node, Edge, useNodesState, useEdgesState, ReactFlowProvider,
} from '@xyflow/react';
import {
  Stack, Group, Title, Button, Select, Text, Badge, Loader, Card, Paper,
  Divider, Tabs, Modal, TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconDeviceFloppy, IconSettings, IconList, IconTool, IconUserPlus } from '@tabler/icons-react';

import DesignerCanvas from '../../components/designer/DesignerCanvas';
import ComponentPalette from '../../components/designer/panels/ComponentPalette';
import NodeConfigPanel from '../../components/designer/panels/NodeConfigPanel';
import MountingSidePanel from '../../components/designer/panels/MountingSidePanel';
import LabourTravelPanel from '../../components/designer/panels/LabourTravelPanel';
import BomPreviewPanel from '../../components/designer/panels/BomPreviewPanel';
import {
  getClients, createClient, createQuote, getQuote,
  saveDesign, loadDesign, generateBomFromDesign, updateQuote, downloadQuotePdf,
} from '../../api/quotes.api';
import { getPanels } from '../../api/components.api';
import { BrandKey, BRAND_TOPOLOGIES, BRAND_OPTIONS } from '../../components/designer/utils/brandTopology';

export default function SystemDesignerPage() {
  return (
    <ReactFlowProvider>
      <DesignerPageInner />
    </ReactFlowProvider>
  );
}

function DesignerPageInner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const quoteId = id ? parseInt(id, 10) : null;

  // State — typed for React Flow
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [panels, setPanels] = useState<any[]>([]);

  // Quote metadata
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<BrandKey>('Victron');
  const [quoteData, setQuoteData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [loading, setLoading] = useState(true);

  // Side panel state
  const [mountingType, setMountingType] = useState('tile');
  const [mountingRows, setMountingRows] = useState(2);
  const [mountingCols, setMountingCols] = useState(6);
  const [travelDistanceKm, setTravelDistanceKm] = useState(0);
  const [pvStringLengthM, setPvStringLengthM] = useState(20);
  const [notes, setNotes] = useState('');

  // BoM state
  const [bomItems, setBomItems] = useState<any[]>([]);
  const [bomFlags, setBomFlags] = useState<any[]>([]);
  const [bomTotals, setBomTotals] = useState<any>(null);
  const [stringsCount, setStringsCount] = useState(0);
  const [panelsPerString, setPanelsPerString] = useState(0);
  const [bomLoading, setBomLoading] = useState(false);

  // Right panel tab
  const [rightTab, setRightTab] = useState<string | null>('config');

  // Add client modal
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [clientSaving, setClientSaving] = useState(false);

  const handleCreateClient = async () => {
    if (!newClientName.trim()) {
      notifications.show({ title: 'Error', message: 'Client name is required', color: 'red' });
      return;
    }
    setClientSaving(true);
    try {
      const result = await createClient({
        name: newClientName.trim(),
        phone: newClientPhone.trim() || undefined,
        email: newClientEmail.trim() || undefined,
        address: newClientAddress.trim() || undefined,
      });
      const newClient = { id: result.id, name: newClientName.trim() };
      setClients((prev) => [...prev, newClient]);
      setSelectedClientId(String(result.id));
      setClientModalOpen(false);
      setNewClientName(''); setNewClientPhone(''); setNewClientEmail(''); setNewClientAddress('');
      notifications.show({ title: 'Created', message: `Client "${newClient.name}" added`, color: 'green' });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to create client', color: 'red' });
    }
    setClientSaving(false);
  };

  // Auto-save timer
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load approved panels
  useEffect(() => {
    getPanels('approved')
      .then(setPanels)
      .catch(() => {
        getPanels().then(setPanels).catch(() => {});
      });
  }, []);

  // Load clients + existing quote data
  useEffect(() => {
    const loadData = async () => {
      try {
        const clientsList = await getClients();
        setClients(clientsList);

        if (quoteId) {
          const { quote } = await getQuote(quoteId);
          setQuoteData(quote);
          setSelectedClientId(String(quote.client_id));
          if (quote.brand) setSelectedBrand(quote.brand as BrandKey);
          if (quote.notes) setNotes(quote.notes);
          if (quote.mounting_type) setMountingType(quote.mounting_type);
          if (quote.mounting_rows) setMountingRows(quote.mounting_rows);
          if (quote.mounting_cols) setMountingCols(quote.mounting_cols);
          if (quote.travel_distance_km) setTravelDistanceKm(quote.travel_distance_km);
          if (quote.pv_string_length_m) setPvStringLengthM(quote.pv_string_length_m);

          const design = await loadDesign(quoteId);
          if (design?.graph) {
            setNodes(design.graph.nodes || []);
            setEdges(design.graph.edges || []);
          }
        }
      } catch {
        notifications.show({ title: 'Error', message: 'Failed to load data', color: 'red' });
      }
      setLoading(false);
    };
    loadData();
  }, [quoteId]);

  // Track unsaved changes — debounced auto-save every 30s
  useEffect(() => {
    if (!quoteId) return;
    setSaveStatus('unsaved');

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      handleSave(true);
    }, 30000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [nodes, edges]);

  // Update selected node reference when nodes change
  useEffect(() => {
    if (selectedNode) {
      const updated = nodes.find((n: Node) => n.id === selectedNode.id);
      if (updated) setSelectedNode(updated);
      else setSelectedNode(null);
    }
  }, [nodes]);

  const handleUpdateNodeData = useCallback(
    (nodeId: string, newData: Record<string, any>) => {
      setNodes((nds: Node[]) =>
        nds.map((n: Node) => (n.id === nodeId ? { ...n, data: newData } : n))
      );
    },
    [setNodes]
  );

  const handleSave = async (isAutoSave = false) => {
    if (!quoteId) return;

    setSaving(true);
    setSaveStatus('saving');
    try {
      await saveDesign(quoteId, { nodes, edges });
      setSaveStatus('saved');
      if (!isAutoSave) {
        notifications.show({ title: 'Saved', message: 'Design saved successfully', color: 'green' });
      }
    } catch {
      setSaveStatus('unsaved');
      if (!isAutoSave) {
        notifications.show({ title: 'Error', message: 'Failed to save design', color: 'red' });
      }
    }
    setSaving(false);
  };

  const handleGenerateBom = async () => {
    if (!quoteId) return;

    // Save design first
    await handleSave(true);

    setBomLoading(true);
    try {
      const result = await generateBomFromDesign(quoteId, {
        mountingType,
        mountingRows,
        mountingCols,
        travelDistanceKm,
        pvStringLengthM,
      });
      setBomItems(result.bom_items || []);
      setBomFlags(result.flags || []);
      setBomTotals(result.totals || null);
      setStringsCount(result.strings_count || 0);
      setPanelsPerString(result.panels_per_string || 0);
      setRightTab('bom');
      notifications.show({ title: 'BoM Generated', message: `${(result.bom_items || []).length} items`, color: 'green' });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to generate BoM', color: 'red' });
    }
    setBomLoading(false);
  };

  const handleFinalize = async () => {
    if (!quoteId) return;
    try {
      await updateQuote(quoteId, { status: 'review', notes });
      notifications.show({ title: 'Finalized', message: 'Quote submitted for review', color: 'green' });
      navigate(`/quotes/${quoteId}`);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to finalize', color: 'red' });
    }
  };

  const handleDownloadPdf = async () => {
    if (!quoteId) return;
    try {
      await downloadQuotePdf(quoteId);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to download PDF', color: 'red' });
    }
  };

  const handleCreateQuote = async () => {
    if (!selectedClientId) {
      notifications.show({ title: 'Error', message: 'Please select a client', color: 'red' });
      return;
    }

    try {
      const { id: newId, quote_number } = await createQuote({
        client_id: Number(selectedClientId),
        design_mode: 'designer',
        brand: selectedBrand,
      });
      notifications.show({ title: 'Created', message: `Quote ${quote_number} created`, color: 'green' });
      navigate(`/quotes/${newId}/design`, { replace: true });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to create quote', color: 'red' });
    }
  };

  if (loading) {
    return <Group justify="center" p="xl"><Loader /></Group>;
  }

  // New quote — show client + brand selection first
  if (!quoteId) {
    const currentTopology = BRAND_TOPOLOGIES[selectedBrand];
    return (
      <Stack maw={500} mx="auto" mt="xl">
        <Group>
          <Button variant="subtle" onClick={() => navigate('/quotes')} leftSection={<IconArrowLeft size={16} />}>
            Quotes
          </Button>
          <Title order={2}>New System Design</Title>
        </Group>
        <Card shadow="sm" radius="md" withBorder p="lg">
          <Stack gap="md">
            <Group align="flex-end" gap="xs">
              <Select
                label="Client"
                placeholder="Select client..."
                data={clients.map((c: any) => ({ value: String(c.id), label: c.name }))}
                value={selectedClientId}
                onChange={setSelectedClientId}
                searchable
                style={{ flex: 1 }}
              />
              <Button variant="light" size="sm" leftSection={<IconUserPlus size={16} />} onClick={() => setClientModalOpen(true)}>
                Add
              </Button>
            </Group>
            <Select
              label="Brand / Topology"
              data={BRAND_OPTIONS.map((b) => ({
                value: b,
                label: `${b} — ${BRAND_TOPOLOGIES[b].type}`,
              }))}
              value={selectedBrand}
              onChange={(val) => { if (val) setSelectedBrand(val as BrandKey); }}
            />
            <Card p="xs" bg="gray.0" radius="sm">
              <Stack gap={4}>
                <Text size="xs" fw={600}>{currentTopology.type}</Text>
                <Text size="xs" c="dimmed">{currentTopology.description}</Text>
                <Group gap={4} mt={4}>
                  {currentTopology.allowedNodeTypes.map((t) => (
                    <Badge key={t} size="xs" variant="light">
                      {t === 'solarPanelArray' ? 'Solar' : t === 'distributionBoard' ? 'DB' : t === 'gridConnection' ? 'Grid' : t.charAt(0).toUpperCase() + t.slice(1)}
                    </Badge>
                  ))}
                </Group>
              </Stack>
            </Card>
            <Button onClick={handleCreateQuote} disabled={!selectedClientId} fullWidth size="md">
              Create Design
            </Button>
          </Stack>
        </Card>

        <Modal opened={clientModalOpen} onClose={() => setClientModalOpen(false)} title="Add New Client" centered>
          <Stack gap="sm">
            <TextInput label="Name" placeholder="Client name" required value={newClientName} onChange={(e) => setNewClientName(e.currentTarget.value)} />
            <TextInput label="Phone" placeholder="Phone number" value={newClientPhone} onChange={(e) => setNewClientPhone(e.currentTarget.value)} />
            <TextInput label="Email" placeholder="Email address" value={newClientEmail} onChange={(e) => setNewClientEmail(e.currentTarget.value)} />
            <TextInput label="Address" placeholder="Address" value={newClientAddress} onChange={(e) => setNewClientAddress(e.currentTarget.value)} />
            <Button onClick={handleCreateClient} loading={clientSaving} fullWidth>
              Create Client
            </Button>
          </Stack>
        </Modal>
      </Stack>
    );
  }

  // Design canvas mode
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
      {/* Top toolbar */}
      <Paper shadow="xs" p="xs" style={{ borderBottom: '1px solid #e9ecef', flexShrink: 0 }}>
        <Group justify="space-between">
          <Group gap="xs">
            <Button variant="subtle" size="xs" onClick={() => navigate(`/quotes/${quoteId}`)} leftSection={<IconArrowLeft size={14} />}>
              Back
            </Button>
            {quoteData && (
              <>
                <Text size="sm" fw={600}>{quoteData.quote_number}</Text>
                <Badge size="sm" variant="light" color="violet">Designer</Badge>
                <Badge size="sm" variant="filled" color={selectedBrand === 'Atess' ? 'orange' : selectedBrand === 'Victron' ? 'blue' : 'gray'}>
                  {selectedBrand} — {BRAND_TOPOLOGIES[selectedBrand].type}
                </Badge>
                <Text size="xs" c="dimmed">{quoteData.client_name}</Text>
              </>
            )}
          </Group>
          <Group gap="xs">
            <Badge
              size="sm"
              variant="light"
              color={saveStatus === 'saved' ? 'green' : saveStatus === 'saving' ? 'yellow' : 'gray'}
            >
              {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved'}
            </Badge>
            <Button size="xs" leftSection={<IconDeviceFloppy size={14} />} onClick={() => handleSave(false)} loading={saving}>
              Save
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* 3-panel layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Component Palette */}
        <div style={{ width: 220, borderRight: '1px solid #e9ecef', background: '#fff', overflow: 'auto', flexShrink: 0 }}>
          <ComponentPalette onDragStart={() => {}} brand={selectedBrand} />
        </div>

        {/* Center: Canvas */}
        <div style={{ flex: 1 }}>
          <DesignerCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            setNodes={setNodes}
            setEdges={setEdges}
            onNodeSelect={setSelectedNode}
            brand={selectedBrand}
          />
        </div>

        {/* Right: Tabbed config/settings/bom panel */}
        <div style={{ width: 300, borderLeft: '1px solid #e9ecef', background: '#fff', overflow: 'auto', flexShrink: 0 }}>
          <Tabs value={rightTab} onChange={setRightTab}>
            <Tabs.List>
              <Tabs.Tab value="config" leftSection={<IconSettings size={14} />}>Config</Tabs.Tab>
              <Tabs.Tab value="settings" leftSection={<IconTool size={14} />}>Settings</Tabs.Tab>
              <Tabs.Tab value="bom" leftSection={<IconList size={14} />}>BoM</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="config" p="xs">
              <NodeConfigPanel
                selectedNode={selectedNode}
                onUpdateNodeData={handleUpdateNodeData}
                panels={panels}
                brand={selectedBrand}
              />
            </Tabs.Panel>

            <Tabs.Panel value="settings" p="xs">
              <Stack gap="md">
                <MountingSidePanel
                  mountingType={mountingType}
                  mountingRows={mountingRows}
                  mountingCols={mountingCols}
                  onChange={(u) => {
                    if (u.mountingType !== undefined) setMountingType(u.mountingType);
                    if (u.mountingRows !== undefined) setMountingRows(u.mountingRows);
                    if (u.mountingCols !== undefined) setMountingCols(u.mountingCols);
                  }}
                />
                <Divider />
                <LabourTravelPanel
                  travelDistanceKm={travelDistanceKm}
                  pvStringLengthM={pvStringLengthM}
                  notes={notes}
                  onChange={(u) => {
                    if (u.travelDistanceKm !== undefined) setTravelDistanceKm(u.travelDistanceKm);
                    if (u.pvStringLengthM !== undefined) setPvStringLengthM(u.pvStringLengthM);
                    if (u.notes !== undefined) setNotes(u.notes);
                  }}
                />
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="bom" p={0}>
              <BomPreviewPanel
                bomItems={bomItems}
                flags={bomFlags}
                totals={bomTotals}
                stringsCount={stringsCount}
                panelsPerString={panelsPerString}
                loading={bomLoading}
                onGenerate={handleGenerateBom}
                onFinalize={handleFinalize}
                onDownloadPdf={handleDownloadPdf}
              />
            </Tabs.Panel>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
