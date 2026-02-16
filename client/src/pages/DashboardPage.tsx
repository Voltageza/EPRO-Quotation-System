import { useState, useEffect } from 'react';
import {
  Title, Text, Card, SimpleGrid, Group, ThemeIcon, Stack, Grid, Box,
  Badge, Table, Progress, RingProgress, Tooltip, Button, Skeleton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconFileInvoice, IconUsers, IconCurrencyDollar, IconCalendarMonth,
  IconArrowRight, IconPlus,
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
  ATT5: '#7950f2', ATT10: '#be4bdb', SG5: '#15aabf', SG8: '#20c997', SG10: '#82c91e', SG10RT: '#94d82d',
};

const CARD_GRADIENTS: Array<{ from: string; to: string }> = [
  { from: '#339af0', to: '#228be6' },
  { from: '#7950f2', to: '#6741d9' },
  { from: '#40c057', to: '#2f9e44' },
  { from: '#fd7e14', to: '#e8590c' },
];

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-ZA');
}

function DashboardSkeleton() {
  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Skeleton height={14} width={120} mb={8} />
          <Skeleton height={28} width={160} mb={6} />
          <Skeleton height={16} width={200} />
        </div>
        <Skeleton height={36} width={120} radius="md" />
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} shadow="sm" padding="lg" radius="md" withBorder>
            <Skeleton height={4} mb="md" />
            <Group justify="space-between">
              <div>
                <Skeleton height={12} width={80} mb={8} />
                <Skeleton height={32} width={100} mb={6} />
                <Skeleton height={12} width={120} />
              </div>
              <Skeleton height={48} width={48} circle />
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      <Grid>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Skeleton height={20} width={140} mb="md" />
            <Skeleton height={28} mb="md" radius="xl" />
            <Stack gap="xs">
              {[1, 2, 3].map((i) => <Skeleton key={i} height={16} width="60%" />)}
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Skeleton height={20} width={180} mb="md" />
            <Group justify="center"><Skeleton height={180} width={180} circle /></Group>
          </Card>
        </Grid.Col>
      </Grid>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Skeleton height={20} width={200} mb="md" />
        <Stack gap="sm">
          {[1, 2, 3].map((i) => <Skeleton key={i} height={24} />)}
        </Stack>
      </Card>

      <Card shadow="sm" radius="md" withBorder p={0}>
        <Box px="md" py="sm"><Skeleton height={20} width={140} /></Box>
        <Stack gap={0} px="md" pb="md">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={44} mt="xs" />)}
        </Stack>
      </Card>
    </Stack>
  );
}

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

  if (loading) return <DashboardSkeleton />;

  const s = stats || {
    total_quotes: 0, total_clients: 0, revenue_cents: 0, quotes_this_month: 0,
    status_breakdown: [], system_class_distribution: [], revenue_by_system_class: [], recent_quotes: [],
  };

  const totalForStatus = s.status_breakdown.reduce((sum, r) => sum + r.count, 0) || 1;
  const totalForClass = s.system_class_distribution.reduce((sum, r) => sum + r.count, 0) || 1;
  const maxRevenue = Math.max(...(s.revenue_by_system_class.map((r) => r.total)), 1);

  const statCards = [
    { label: 'Total Quotes', value: String(s.total_quotes), desc: 'All quotes created', icon: IconFileInvoice, color: 'blue' },
    { label: 'Total Clients', value: String(s.total_clients), desc: 'Unique client accounts', icon: IconUsers, color: 'violet' },
    { label: 'Revenue', value: formatPrice(s.revenue_cents), desc: 'Total approved value', icon: IconCurrencyDollar, color: 'green' },
    { label: 'This Month', value: String(s.quotes_this_month), desc: 'Quotes created this month', icon: IconCalendarMonth, color: 'orange' },
  ];

  const today = new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <Stack>
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={2}>{today}</Text>
          <Title order={2} fw={800}>Dashboard</Title>
          <Text c="dimmed" size="sm">Welcome back, {user?.display_name}</Text>
        </div>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => navigate('/quotes/design/new')}
          radius="md"
        >
          New Quote
        </Button>
      </Group>

      {/* Stat Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        {statCards.map((card, idx) => (
          <Card
            key={card.label}
            shadow="sm"
            padding="lg"
            radius="md"
            withBorder
            style={{
              transition: 'transform 150ms ease, box-shadow 150ms ease',
              overflow: 'visible',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            {/* Gradient accent bar */}
            <Box
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                borderRadius: '4px 4px 0 0',
                background: `linear-gradient(90deg, ${CARD_GRADIENTS[idx].from}, ${CARD_GRADIENTS[idx].to})`,
              }}
            />
            <Group justify="space-between" align="flex-start" mt={4}>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{card.label}</Text>
                <Text style={{ fontSize: '2rem' }} fw={800} lh={1.2} mt={4}>{card.value}</Text>
                <Text size="xs" c="dimmed" mt={4}>{card.desc}</Text>
              </div>
              <ThemeIcon size={48} radius="xl" color={card.color} variant="light" style={{ opacity: 0.7 }}>
                <card.icon size={24} />
              </ThemeIcon>
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      {/* Analytics Row — 7 + 5 */}
      <Grid>
        {/* Quote Pipeline */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder h="100%">
            <Text fw={700} size="lg" mb="md">Quote Pipeline</Text>
            <Progress.Root size={28} mb="lg" style={{ borderRadius: 'var(--mantine-radius-xl)' }}>
              {s.status_breakdown.map((row) => (
                <Tooltip
                  key={row.status}
                  label={`${row.status.charAt(0).toUpperCase() + row.status.slice(1)}: ${row.count} (${((row.count / totalForStatus) * 100).toFixed(0)}%)`}
                  withArrow
                >
                  <Progress.Section
                    value={(row.count / totalForStatus) * 100}
                    color={STATUS_COLORS[row.status] || '#868e96'}
                  />
                </Tooltip>
              ))}
            </Progress.Root>
            <Stack gap={8}>
              {s.status_breakdown.map((row) => {
                const pct = ((row.count / totalForStatus) * 100).toFixed(0);
                return (
                  <Group key={row.status} justify="space-between">
                    <Group gap={8}>
                      <Box
                        style={{
                          width: 10, height: 10, borderRadius: '50%',
                          backgroundColor: STATUS_COLORS[row.status] || '#868e96',
                          flexShrink: 0,
                        }}
                      />
                      <Text size="sm" tt="capitalize">{row.status}</Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="sm" fw={600}>{row.count}</Text>
                      <Text size="xs" c="dimmed">({pct}%)</Text>
                    </Group>
                  </Group>
                );
              })}
            </Stack>
          </Card>
        </Grid.Col>

        {/* System Class Distribution */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder h="100%">
            <Text fw={700} size="lg" mb="md">System Classes</Text>
            <Group justify="center" mb="md">
              <RingProgress
                size={180}
                thickness={22}
                roundCaps
                sections={s.system_class_distribution.map((row) => ({
                  value: (row.count / totalForClass) * 100,
                  color: CLASS_COLORS[row.system_class] || '#868e96',
                  tooltip: `${row.system_class}: ${row.count}`,
                }))}
                label={
                  <div style={{ textAlign: 'center' }}>
                    <Text size="xl" fw={800} lh={1}>{s.total_quotes}</Text>
                    <Text size="xs" c="dimmed">Quotes</Text>
                  </div>
                }
              />
            </Group>
            <SimpleGrid cols={2} spacing="xs">
              {s.system_class_distribution.map((row) => (
                <Group key={row.system_class} gap={8}>
                  <Box
                    style={{
                      width: 12, height: 12, borderRadius: 3,
                      backgroundColor: CLASS_COLORS[row.system_class] || '#868e96',
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <Text size="sm" fw={600}>{row.system_class}</Text>
                    <Text size="xs" c="dimmed">{row.count} ({((row.count / totalForClass) * 100).toFixed(0)}%)</Text>
                  </div>
                </Group>
              ))}
            </SimpleGrid>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Revenue by System Class */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Text fw={700} size="lg" mb="md">Revenue by System Class</Text>
        {s.revenue_by_system_class.length === 0 ? (
          <Text c="dimmed" ta="center" py="lg">No revenue data yet</Text>
        ) : (
          <Stack gap="md">
            {s.revenue_by_system_class.map((row) => (
              <div key={row.system_class}>
                <Group justify="space-between" mb={4}>
                  <Group gap={8}>
                    <Box
                      style={{
                        width: 12, height: 12, borderRadius: 3,
                        backgroundColor: CLASS_COLORS[row.system_class] || '#868e96',
                        flexShrink: 0,
                      }}
                    />
                    <Text size="sm" fw={600}>{row.system_class}</Text>
                  </Group>
                  <Text size="sm" fw={600}>{formatPrice(row.total)}</Text>
                </Group>
                <Progress
                  value={(row.total / maxRevenue) * 100}
                  color={CLASS_COLORS[row.system_class] || '#868e96'}
                  size="lg"
                  radius="xl"
                />
              </div>
            ))}
          </Stack>
        )}
      </Card>

      {/* Recent Quotes */}
      <Card shadow="sm" radius="md" withBorder p={0}>
        <Group justify="space-between" px="md" py="sm">
          <div>
            <Text fw={700} size="lg">Recent Quotes</Text>
            <Text size="xs" c="dimmed">Last 10 quotes</Text>
          </div>
          <Button
            variant="subtle"
            size="xs"
            rightSection={<IconArrowRight size={14} />}
            onClick={() => navigate('/quotes')}
          >
            View All
          </Button>
        </Group>
        {s.recent_quotes.length === 0 ? (
          <Text p="md" ta="center" c="dimmed">No quotes yet.</Text>
        ) : (
          <Table highlightOnHover verticalSpacing="sm">
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
              {s.recent_quotes.map((q) => {
                const initial = q.client_name?.charAt(0)?.toUpperCase() || '?';
                return (
                  <Table.Tr
                    key={q.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/quotes/${q.id}`)}
                  >
                    <Table.Td>
                      <Text size="sm" fw={600} c="blue">{q.quote_number}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={8}>
                        <Box
                          style={{
                            width: 28, height: 28, borderRadius: '50%',
                            backgroundColor: 'var(--mantine-color-blue-1)',
                            color: 'var(--mantine-color-blue-7)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 700, flexShrink: 0,
                          }}
                        >
                          {initial}
                        </Box>
                        <Text size="sm">{q.client_name}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={CLASS_COLORS[q.system_class] ? undefined : 'gray'}
                        style={{ backgroundColor: CLASS_COLORS[q.system_class] }}
                        variant="filled" size="sm"
                      >
                        {q.system_class}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" fw={500}>{q.total_cents ? formatPrice(q.total_cents) : '—'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={STATUS_COLORS[q.status] || 'gray'} variant="dot" size="sm">
                        {q.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">{relativeDate(q.created_at)}</Text>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}
