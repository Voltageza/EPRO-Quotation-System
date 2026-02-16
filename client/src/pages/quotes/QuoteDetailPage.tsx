import { useState, useEffect } from 'react';
import {
  Title, Card, Stack, Table, Text, Badge, Group, Loader, Button,
  Alert, Divider, Grid,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft, IconEdit, IconDownload, IconCheck, IconCopy,
  IconAlertTriangle, IconAlertCircle, IconInfoCircle,
} from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { getQuote, updateQuote, downloadQuotePdf, cloneQuote } from '../../api/quotes.api';

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

const statusColor: Record<string, string> = {
  draft: 'gray', review: 'yellow', approved: 'green', sent: 'blue', rejected: 'red', expired: 'orange',
};

const classColor: Record<string, string> = {
  V5: 'blue', V8: 'teal', V10: 'orange', V15: 'red',
  ATT5: 'violet', ATT10: 'grape', SG5: 'cyan', SG8: 'teal', SG10: 'lime', SG10RT: 'lime',
};

interface BomItem {
  id: number; sku: string; product_name: string; unit: string;
  section: string; quantity: number; unit_price_cents: number; line_total_cents: number;
}

interface Flag { code: string; severity: string; message: string; is_blocking: boolean | number }

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const quoteId = parseInt(id!, 10);

  const [quote, setQuote] = useState<any>(null);
  const [bomItems, setBomItems] = useState<BomItem[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getQuote(quoteId)
      .then(({ quote: q, bom_items, flags: f }) => {
        setQuote(q);
        setBomItems(bom_items || []);
        setFlags(f || []);
      })
      .catch(() => notifications.show({ title: 'Error', message: 'Failed to load quote', color: 'red' }))
      .finally(() => setLoading(false));
  }, [quoteId]);

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await updateQuote(quoteId, { status: 'approved' });
      setQuote((prev: any) => ({ ...prev, status: 'approved' }));
      notifications.show({ title: 'Approved', message: 'Quote approved', color: 'green' });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to approve', color: 'red' });
    }
    setActionLoading(false);
  };

  const handleSend = async () => {
    setActionLoading(true);
    try {
      await updateQuote(quoteId, { status: 'sent' });
      setQuote((prev: any) => ({ ...prev, status: 'sent' }));
      notifications.show({ title: 'Sent', message: 'Quote marked as sent', color: 'blue' });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to update', color: 'red' });
    }
    setActionLoading(false);
  };

  const handleDownloadPdf = async () => {
    try {
      await downloadQuotePdf(quoteId);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to download PDF', color: 'red' });
    }
  };

  const handleClone = async () => {
    setActionLoading(true);
    try {
      const { id: newId, quote_number } = await cloneQuote(quoteId);
      notifications.show({ title: 'Cloned', message: `Created ${quote_number}`, color: 'teal' });
      navigate(`/quotes/${newId}/edit`);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to clone quote', color: 'red' });
    }
    setActionLoading(false);
  };

  if (loading) return <Group justify="center" p="xl"><Loader /></Group>;
  if (!quote) return <Text>Quote not found</Text>;

  // Group BoM items by section
  const groupedBom: Record<string, BomItem[]> = {};
  for (const item of bomItems) {
    if (!groupedBom[item.section]) groupedBom[item.section] = [];
    groupedBom[item.section].push(item);
  }

  return (
    <Stack>
      {/* Header */}
      <Group justify="space-between">
        <Group>
          <Button variant="subtle" onClick={() => navigate('/quotes')} leftSection={<IconArrowLeft size={16} />}>
            Quotes
          </Button>
          <Title order={2}>{quote.quote_number}</Title>
          <Badge color={statusColor[quote.status] || 'gray'} size="lg" variant="light">
            {quote.status}
          </Badge>
          <Badge color={classColor[quote.system_class] || 'gray'} size="lg">
            {quote.system_class}
          </Badge>
          {quote.design_mode === 'designer' && (
            <Badge size="lg" variant="light" color="violet">Designer</Badge>
          )}
        </Group>
        <Group>
          <Button variant="outline" onClick={handleDownloadPdf} leftSection={<IconDownload size={16} />}>
            Download PDF
          </Button>
          <Button variant="outline" color="teal" onClick={handleClone} loading={actionLoading} leftSection={<IconCopy size={16} />}>
            Clone
          </Button>
          {(quote.status === 'draft' || quote.status === 'review') && (
            <Button
              variant="outline"
              onClick={() => navigate(
                quote.design_mode === 'designer'
                  ? `/quotes/${quoteId}/design`
                  : `/quotes/${quoteId}/edit`
              )}
              leftSection={<IconEdit size={16} />}
            >
              Edit
            </Button>
          )}
          {quote.status === 'review' && (
            <Button color="green" onClick={handleApprove} loading={actionLoading} leftSection={<IconCheck size={16} />}>
              Approve
            </Button>
          )}
          {quote.status === 'approved' && (
            <Button color="blue" onClick={handleSend} loading={actionLoading}>
              Mark Sent
            </Button>
          )}
        </Group>
      </Group>

      {/* Client & System Info */}
      <Grid>
        <Grid.Col span={6}>
          <Card shadow="sm" radius="md" withBorder p="lg">
            <Text fw={600} mb="sm">Client</Text>
            <Text size="sm">{quote.client_name}</Text>
            {quote.client_phone && <Text size="sm" c="dimmed">Phone: {quote.client_phone}</Text>}
            {quote.client_email && <Text size="sm" c="dimmed">Email: {quote.client_email}</Text>}
            {quote.client_address && <Text size="sm" c="dimmed">Address: {quote.client_address}</Text>}
          </Card>
        </Grid.Col>
        <Grid.Col span={6}>
          <Card shadow="sm" radius="md" withBorder p="lg">
            <Text fw={600} mb="sm">System Configuration</Text>
            <Text size="sm">System: {quote.system_class}</Text>
            <Text size="sm">Panels: {quote.panel_qty ?? '—'}</Text>
            {quote.strings_count > 0 && (
              <Text size="sm">Strings: {quote.strings_count} x {quote.panels_per_string} panels</Text>
            )}
            <Text size="sm">Batteries: {quote.battery_qty ?? '—'}</Text>
            <Text size="sm">MPPTs: {quote.mppt_qty ?? '—'}</Text>
            <Text size="xs" c="dimmed" mt="xs">
              Created: {new Date(quote.created_at).toLocaleDateString('en-ZA')}
            </Text>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Flags */}
      {flags.map((flag, i) => (
        <Alert
          key={i}
          color={flag.severity === 'error' ? 'red' : flag.severity === 'warning' ? 'yellow' : 'blue'}
          icon={flag.severity === 'error' ? <IconAlertCircle size={16} /> : flag.severity === 'warning' ? <IconAlertTriangle size={16} /> : <IconInfoCircle size={16} />}
        >
          <Text size="sm">{flag.message}</Text>
        </Alert>
      ))}

      {/* BoM */}
      {bomItems.length > 0 && (
        <>
          <Title order={3} mt="sm">Bill of Materials</Title>
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
                <Table striped layout="fixed">
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
        </>
      )}

      {/* Totals */}
      {quote.total_cents && (
        <Card shadow="sm" radius="md" withBorder p="lg">
          <Stack gap="xs" align="flex-end">
            <Group gap="xl">
              <Text size="sm">Subtotal:</Text>
              <Text size="sm" fw={500} w={120} ta="right">{formatPrice(quote.subtotal_cents)}</Text>
            </Group>
            <Group gap="xl">
              <Text size="sm">VAT (15%):</Text>
              <Text size="sm" fw={500} w={120} ta="right">{formatPrice(quote.vat_cents)}</Text>
            </Group>
            <Divider w={200} />
            <Group gap="xl">
              <Text size="lg" fw={700}>Total:</Text>
              <Text size="lg" fw={700} w={120} ta="right">{formatPrice(quote.total_cents)}</Text>
            </Group>
          </Stack>
        </Card>
      )}

      {/* Notes */}
      {quote.notes && (
        <Card shadow="sm" radius="md" withBorder p="lg">
          <Text fw={600} mb="xs">Notes</Text>
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{quote.notes}</Text>
        </Card>
      )}
    </Stack>
  );
}
