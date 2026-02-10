import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppShell as MantineAppShell,
  NavLink,
  Group,
  Title,
  Text,
  Button,
  Divider,
  Box,
} from '@mantine/core';
import {
  IconDashboard,
  IconFileInvoice,
  IconPackage,
  IconSolarPanel,
  IconCpu,
  IconCash,
  IconUsers,
  IconLogout,
  IconSettings,
  IconTool,
} from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';

interface Props {
  children: ReactNode;
}

export default function AppShell({ children }: Props) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', icon: IconDashboard, path: '/' },
    { label: 'Quotes', icon: IconFileInvoice, path: '/quotes' },
  ];

  const toolsItems = [
    { label: 'Bracket Calculator', icon: IconTool, path: '/tools/bracket-calculator' },
  ];

  const adminItems = [
    { label: 'Products', icon: IconPackage, path: '/admin/products' },
    { label: 'Panels', icon: IconSolarPanel, path: '/admin/panels' },
    { label: 'Components', icon: IconCpu, path: '/admin/components' },
    { label: 'Rules', icon: IconSettings, path: '/admin/rules' },
    { label: 'Pricing', icon: IconCash, path: '/admin/pricing' },
    { label: 'Users', icon: IconUsers, path: '/admin/users' },
  ];

  return (
    <MantineAppShell
      navbar={{ width: 250, breakpoint: 'sm' }}
      padding="md"
    >
      <MantineAppShell.Navbar p="sm">
        <Box mb="md">
          <Title order={4} c="blue">EPRO Quotation</Title>
          <Text size="xs" c="dimmed">Electrical Pro</Text>
        </Box>

        {navItems.map((item) => (
          <NavLink
            key={item.path}
            label={item.label}
            leftSection={<item.icon size={18} />}
            active={location.pathname === item.path}
            onClick={() => navigate(item.path)}
            mb={2}
          />
        ))}

        <Divider my="sm" label="Tools" labelPosition="left" />
        {toolsItems.map((item) => (
          <NavLink
            key={item.path}
            label={item.label}
            leftSection={<item.icon size={18} />}
            active={location.pathname === item.path}
            onClick={() => navigate(item.path)}
            mb={2}
          />
        ))}

        {isAdmin && (
          <>
            <Divider my="sm" label="Admin" labelPosition="left" />
            {adminItems.map((item) => (
              <NavLink
                key={item.path}
                label={item.label}
                leftSection={<item.icon size={18} />}
                active={location.pathname === item.path}
                onClick={() => navigate(item.path)}
                mb={2}
              />
            ))}
          </>
        )}

        <Box mt="auto" pt="md">
          <Divider mb="sm" />
          <Group justify="space-between">
            <div>
              <Text size="sm" fw={500}>{user?.display_name}</Text>
              <Text size="xs" c="dimmed" tt="capitalize">{user?.role}</Text>
            </div>
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              onClick={() => { logout(); navigate('/login'); }}
              leftSection={<IconLogout size={14} />}
            >
              Logout
            </Button>
          </Group>
        </Box>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>
        {children}
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
