import { useState } from 'react';
import {
  Stack, Text, Card, Table, Group, Button, Divider,
  Alert, Loader, Collapse,
} from '@mantine/core';
import {
  IconChevronDown, IconChevronUp, IconAlertTriangle,
  IconAlertCircle, IconInfoCircle, IconDownload, IconCheck,
} from '@tabler/icons-react';

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

interface BomItem {
  sku: string;
  product_name: string;
  section: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
}

interface Flag {
  code: string;
  severity: string;
  message: string;
  is_blocking: boolean | number;
}

interface BomPreviewPanelProps {
  bomItems: BomItem[];
  flags: Flag[];
  totals: { subtotal_cents: number; vat_cents: number; total_cents: number } | null;
  stringsCount: number;
  panelsPerString: number;
  loading: boolean;
  onGenerate: () => void;
  onFinalize: () => void;
  onDownloadPdf: () => void;
}

export default function BomPreviewPanel({
  bomItems,
  flags,
  totals,
  stringsCount,
  panelsPerString,
  loading,
  onGenerate,
  onFinalize,
  onDownloadPdf,
}: BomPreviewPanelProps) {
  const [expanded, setExpanded] = useState(true);

  // Group items by section
  const grouped: Record<string, BomItem[]> = {};
  for (const item of bomItems) {
    if (!grouped[item.section]) grouped[item.section] = [];
    grouped[item.section].push(item);
  }

  const hasBlockingFlags = flags.some((f) => f.is_blocking);

  return (
    <Stack gap="xs" p="xs">
      <Group justify="space-between">
        <Text size="sm" fw={700}>Bill of Materials</Text>
        <Button
          size="xs"
          variant={bomItems.length > 0 ? 'subtle' : 'filled'}
          onClick={onGenerate}
          loading={loading}
        >
          {bomItems.length > 0 ? 'Regenerate' : 'Generate BoM'}
        </Button>
      </Group>

      {loading && (
        <Group justify="center" p="md">
          <Loader size="sm" />
          <Text size="xs" c="dimmed">Generating BoM...</Text>
        </Group>
      )}

      {/* Flags */}
      {flags.length > 0 && (
        <Stack gap={4}>
          {flags.map((flag, i) => (
            <Alert
              key={i}
              color={flag.severity === 'error' ? 'red' : flag.severity === 'warning' ? 'yellow' : 'blue'}
              icon={flag.severity === 'error' ? <IconAlertCircle size={14} /> : flag.severity === 'warning' ? <IconAlertTriangle size={14} /> : <IconInfoCircle size={14} />}
              p="xs"
            >
              <Text size="xs">{flag.message}</Text>
            </Alert>
          ))}
        </Stack>
      )}

      {/* String config info */}
      {stringsCount > 0 && (
        <Card p="xs" bg="blue.0" radius="sm">
          <Text size="xs">
            PV Config: {stringsCount} string{stringsCount !== 1 ? 's' : ''} of {panelsPerString} panels
          </Text>
        </Card>
      )}

      {/* Collapsible BoM sections */}
      {bomItems.length > 0 && (
        <>
          <Button
            variant="subtle"
            size="xs"
            onClick={() => setExpanded(!expanded)}
            rightSection={expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
          >
            {expanded ? 'Collapse' : 'Expand'} ({bomItems.length} items)
          </Button>

          <Collapse in={expanded}>
            <Stack gap={4}>
              {SECTION_ORDER.map((section) => {
                const items = grouped[section];
                if (!items || items.length === 0) return null;
                const sectionTotal = items.reduce((sum, item) => sum + item.line_total_cents, 0);

                return (
                  <Card key={section} p={0} radius="sm" withBorder>
                    <Group bg="gray.1" px="xs" py={4} justify="space-between">
                      <Text size="xs" fw={600}>{SECTION_LABELS[section] || section}</Text>
                      <Text size="xs" fw={500} c="dimmed">{formatPrice(sectionTotal)}</Text>
                    </Group>
                    <Table striped horizontalSpacing="xs" verticalSpacing={2}>
                      <Table.Tbody>
                        {items.map((item, idx) => (
                          <Table.Tr key={idx}>
                            <Table.Td w="50%"><Text size="xs" lineClamp={1}>{item.product_name}</Text></Table.Td>
                            <Table.Td w="15%" ta="center"><Text size="xs">{item.quantity}</Text></Table.Td>
                            <Table.Td w="35%" ta="right"><Text size="xs">{formatPrice(item.line_total_cents)}</Text></Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Card>
                );
              })}
            </Stack>
          </Collapse>

          {/* Totals */}
          {totals && (
            <Card p="xs" radius="sm" withBorder>
              <Stack gap={2} align="flex-end">
                <Group gap="lg">
                  <Text size="xs">Subtotal:</Text>
                  <Text size="xs" fw={500}>{formatPrice(totals.subtotal_cents)}</Text>
                </Group>
                <Group gap="lg">
                  <Text size="xs">VAT (15%):</Text>
                  <Text size="xs" fw={500}>{formatPrice(totals.vat_cents)}</Text>
                </Group>
                <Divider w="100%" />
                <Group gap="lg">
                  <Text size="sm" fw={700}>Total:</Text>
                  <Text size="sm" fw={700}>{formatPrice(totals.total_cents)}</Text>
                </Group>
              </Stack>
            </Card>
          )}

          {/* Action buttons */}
          <Group gap="xs">
            <Button
              size="xs"
              variant="outline"
              leftSection={<IconDownload size={14} />}
              onClick={onDownloadPdf}
              disabled={!totals}
            >
              PDF
            </Button>
            <Button
              size="xs"
              color="green"
              leftSection={<IconCheck size={14} />}
              onClick={onFinalize}
              disabled={!totals || hasBlockingFlags}
            >
              Finalize
            </Button>
          </Group>
        </>
      )}
    </Stack>
  );
}
