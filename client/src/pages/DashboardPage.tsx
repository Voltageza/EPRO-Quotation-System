import { useState, useEffect } from 'react';
import {
  Title, Text, Card, SimpleGrid, Group, ThemeIcon, Stack, Loader,
  Badge, Table, Progress, RingProgress,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconFileInvoice, IconUsers, IconCurrencyDollar, IconCalendarMonth,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDashboardStats, DashboardStats } from '../api/quotes.api';

const formatPrice = (cents: number) => `R ${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

const STATUS_COLORS: Record<string, string> = {
  draft: '#868e96', pending: '#fab005', approved: '#40c057', sent: '#339af0',
  rejected: '#fa5252', expired: '#fd7e14', accepted: '#20c997',
};

const CLASS_COLORS: Record<string, string> = {
  V5: '#339af0', V8: '#20c997', V10: '#fd7e14', V15: '#fa5252',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(() => notifications.show({ title: 'Error', message: 'Failed to load dashboard stats', color: 'red' }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Group justify="center" p="xl"><Loader /></Group>;

  const s = stats || {
    total_quotes: 0, total_clients: 0, revenue_cents: 0, quotes_this_month: 0,
    status_breakdown: [], system_class_distribution: [], revenue_by_system_class: [], recent_quotes: [],
  };

  const totalForStatus = s.status_breakdown.reduce((sum, r) => sum + r.count, 0) || 1;
  const totalForClass = s.system_class_distribution.reduce((sum, r) => sum + r.count, 0) || 1;

  const statCards = [
    { label: 'Total Quotes', value: String(s.total_quotes), icon: IconFileInvoice, color: 'blue' },
    { label: 'Total Clients', value: String(s.total_clients), icon: IconUsers, color: 'violet' },
    { label: 'Revenue', value: formatPrice(s.revenue_cents), icon: IconCurrencyDollar, color: 'green' },
    { label: 'This Month', value: String(s.quotes_this_month), icon: IconCalendarMonth, color: 'orange' },
  ];

  return (
    <Stack>
      <div>
        <Title order={2}>Dashboard</Title>
        <Text c="dimmed">Welcome back, {user?.display_name}</Text>
      </div>

      {/* Stat Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        {statCards.map((card) => (
          <Card key={card.label} shadow="sm" padding="lg" radius="md" withBorder>
            <Group>
              <ThemeIcon size="xl" radius="md" color={card.color} variant="light">
                <card.icon size={24} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{card.label}</Text>
                <Text size="xl" fw={700}>{card.value}</Text>
              </div>
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      {/* Status Breakdown + System Distribution */}
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {/* Quote Status Breakdown */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Text fw={600} mb="md">Quote Status Breakdown</Text>
          <Progress.Root size={24} mb="md">
            {s.status_breakdown.map((row) => (
              <Progress.Section
                key={row.status}
                value={(row.count / totalForStatus) * 100}
                color={STATUS_COLORS[row.status] || '#868e96'}
              >
                <Progress.Label>{row.count}</Progress.Label>
              </Progress.Section>
            ))}
          </Progress.Root>
          <Group gap="xs" wrap="wrap">
            {s.status_breakdown.map((row) => (
              <Badge
                key={row.status}
                color={STATUS_COLORS[row.status] || 'gray'}
                variant="light"
                size="sm"
              >
                {row.status}: {row.count}
              </Badge>
            ))}
          </Group>
        </Card>

        {/* System Class Distribution */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Text fw={600} mb="md">System Class Distribution</Text>
          <Group justify="center">
            <RingProgress
              size={160}
              thickness={20}
              roundCaps
              sections={s.system_class_distribution.map((row) => ({
                value: (row.count / totalForClass) * 100,
                color: CLASS_COLORS[row.system_class] || '#868e96',
                tooltip: `${row.system_class}: ${row.count}`,
              }))}
              label={
                <Text ta="center" size="lg" fw={700}>{s.total_quotes}</Text>
              }
            />
          </Group>
          <Group justify="center" gap="xs" mt="md" wrap="wrap">
            {s.system_class_distribution.map((row) => (
              <Badge
                key={row.system_class}
                color={CLASS_COLORS[row.system_class] || 'gray'}
                variant="light"
                size="sm"
              >
                {row.system_class}: {row.count}
              </Badge>
            ))}
          </Group>
        </Card>
      </SimpleGrid>

      {/* Recent Quotes */}
      <Card shadow="sm" radius="md" withBorder p={0}>
        <Group px="md" py="sm">
          <Text fw={600}>Recent Quotes</Text>
        </Group>
        {s.recent_quotes.length === 0 ? (
          <Text p="md" ta="center" c="dimmed">No quotes yet.</Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Quote #</Table.Th>
                <Table.Th>Client</Table.Th>
                <Table.Th>System</Table.Th>
                <Table.Th ta="right">Total</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Date</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {s.recent_quotes.map((q) => (
                <Table.Tr
                  key={q.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/quotes/${q.id}`)}
                >
                  <Table.Td><Text size="sm" fw={600}>{q.quote_number}</Text></Table.Td>
                  <Table.Td>{q.client_name}</Table.Td>
                  <Table.Td>
                    <Badge color={CLASS_COLORS[q.system_class] ? undefined : 'gray'}
                      style={{ backgroundColor: CLASS_COLORS[q.system_class] }}
                      variant="filled" size="sm">
                      {q.system_class}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">
                    {q.total_cents ? formatPrice(q.total_cents) : '—'}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={STATUS_COLORS[q.status] || 'gray'} variant="light" size="sm">
                      {q.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">{new Date(q.created_at).toLocaleDateString('en-ZA')}</Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}
