import { Title, Text, Card, SimpleGrid, Group, ThemeIcon, Stack } from '@mantine/core';
import { IconFileInvoice, IconPackage, IconBolt, IconUsers } from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();

  const stats = [
    { label: 'Quotes', value: '—', icon: IconFileInvoice, color: 'blue' },
    { label: 'Products', value: '—', icon: IconPackage, color: 'green' },
    { label: 'Systems', value: '4', icon: IconBolt, color: 'orange' },
    { label: 'Users', value: '—', icon: IconUsers, color: 'violet' },
  ];

  return (
    <Stack>
      <div>
        <Title order={2}>Dashboard</Title>
        <Text c="dimmed">Welcome back, {user?.display_name}</Text>
      </div>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        {stats.map((stat) => (
          <Card key={stat.label} shadow="sm" padding="lg" radius="md" withBorder>
            <Group>
              <ThemeIcon size="xl" radius="md" color={stat.color} variant="light">
                <stat.icon size={24} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{stat.label}</Text>
                <Text size="xl" fw={700}>{stat.value}</Text>
              </div>
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="sm">Victron System Classes</Title>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          {[
            { name: 'V5', desc: '5000VA MultiPlus-II', color: 'blue' },
            { name: 'V8', desc: '8000VA MultiPlus-II', color: 'teal' },
            { name: 'V10', desc: '10000VA MultiPlus-II', color: 'orange' },
            { name: 'V15', desc: '15000VA MultiPlus-II', color: 'red' },
          ].map((sys) => (
            <Card key={sys.name} padding="sm" radius="sm" withBorder>
              <Text fw={700} c={sys.color}>{sys.name}</Text>
              <Text size="sm" c="dimmed">{sys.desc}</Text>
            </Card>
          ))}
        </SimpleGrid>
      </Card>
    </Stack>
  );
}
