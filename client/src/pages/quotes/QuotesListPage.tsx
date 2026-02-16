import { useState, useEffect } from 'react';
import {
  Title, Card, Stack, Table, Text, Badge, Group, Loader,
  Select, Button, ActionIcon, Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconEye, IconPlus, IconCopy, IconBrush } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { getQuotes, cloneQuote } from '../../api/quotes.api';

interface Quote {
  id: number;
  quote_number: string;
  client_name: string;
  system_class: string;
  design_mode: string;
  status: string;
  panel_qty: number | null;
  battery_qty: number | null;
  total_cents: number | null;
  created_at: string;
  updated_at: string;
}

const formatPrice = (cents: number) => `R ${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

const statusColor: Record<string, string> = {
  draft: 'gray', pending: 'yellow', approved: 'green', sent: 'blue', rejected: 'red', expired: 'orange',
};

const classColor: Record<string, string> = {
  V5: 'blue', V8: 'teal', V10: 'orange', V15: 'red',
  ATT5: 'violet', ATT10: 'grape', SG5: 'cyan', SG8: 'teal', SG10: 'lime', SG10RT: 'lime',
};

export default function QuotesListPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadQuotes = () => {
    setLoading(true);
    getQuotes(statusFilter || undefined)
      .then(setQuotes)
      .catch(() => notifications.show({ title: 'Error', message: 'Failed to load quotes', color: 'red' }))
      .finally(() => setLoading(false));
  };

  const handleClone = async (quoteId: number) => {
    try {
      const { id, quote_number } = await cloneQuote(quoteId);
      notifications.show({ title: 'Cloned', message: `Created ${quote_number}`, color: 'teal' });
      navigate(`/quotes/${id}/edit`);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to clone quote', color: 'red' });
    }
  };

  useEffect(() => { loadQuotes(); }, [statusFilter]);

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Quotes</Title>
        <Group>
          <Select
            placeholder="Filter by status"
            clearable
            data={['draft', 'pending', 'approved', 'sent', 'rejected', 'expired']}
            value={statusFilter}
            onChange={setStatusFilter}
            w={160}
          />
          <Button variant="outline" leftSection={<IconPlus size={16} />} onClick={() => navigate('/quotes/new')}>
            Wizard
          </Button>
          <Button leftSection={<IconBrush size={16} />} onClick={() => navigate('/quotes/design/new')}>
            New Design
          </Button>
        </Group>
      </Group>

      {loading ? (
        <Group justify="center" p="xl"><Loader /></Group>
      ) : quotes.length === 0 ? (
        <Card shadow="sm" radius="md" withBorder p="xl">
          <Text ta="center" c="dimmed">No quotes found. Click "New Quote" to create one.</Text>
        </Card>
      ) : (
        <Card shadow="sm" radius="md" withBorder p={0}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Quote #</Table.Th>
                <Table.Th>Client</Table.Th>
                <Table.Th>System</Table.Th>
                <Table.Th>Mode</Table.Th>
                <Table.Th ta="center">Panels</Table.Th>
                <Table.Th ta="center">Batteries</Table.Th>
                <Table.Th ta="right">Total</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th ta="center">Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {quotes.map((q) => (
                <Table.Tr key={q.id}>
                  <Table.Td>
                    <Text size="sm" fw={600}>{q.quote_number}</Text>
                  </Table.Td>
                  <Table.Td>{q.client_name}</Table.Td>
                  <Table.Td>
                    <Badge color={classColor[q.system_class] || 'gray'}>{q.system_class}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" variant="light" color={q.design_mode === 'designer' ? 'violet' : 'gray'}>
                      {q.design_mode === 'designer' ? 'Design' : 'Wizard'}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="center">{q.panel_qty ?? '—'}</Table.Td>
                  <Table.Td ta="center">{q.battery_qty ?? '—'}</Table.Td>
                  <Table.Td ta="right">
                    {q.total_cents ? formatPrice(q.total_cents) : '—'}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={statusColor[q.status] || 'gray'} variant="light">
                      {q.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">{new Date(q.created_at).toLocaleDateString()}</Text>
                  </Table.Td>
                  <Table.Td ta="center">
                    <Group gap={4} justify="center">
                      <Tooltip label="View Quote">
                        <ActionIcon variant="subtle" onClick={() => navigate(`/quotes/${q.id}`)}>
                          <IconEye size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Clone Quote">
                        <ActionIcon variant="subtle" color="teal" onClick={() => handleClone(q.id)}>
                          <IconCopy size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}
    </Stack>
  );
}
