import { useState, useEffect } from 'react';
import {
  Title, Table, Button, Group, TextInput, Select, PasswordInput,
  Modal, Stack, Text, Badge, ActionIcon, Card, Loader, Switch,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconEdit } from '@tabler/icons-react';
import { getUsers, createUser, updateUser } from '../../api/auth.api';

interface User {
  id: number;
  username: string;
  display_name: string;
  role: string;
  is_active: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const [formUsername, setFormUsername] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<string>('sales');

  const loadUsers = async () => {
    setLoading(true);
    try {
      setUsers(await getUsers());
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load users', color: 'red' });
    }
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const openCreate = () => {
    setEditing(null);
    setFormUsername(''); setFormDisplayName('');
    setFormPassword(''); setFormRole('sales');
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setFormUsername(u.username); setFormDisplayName(u.display_name);
    setFormPassword(''); setFormRole(u.role);
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await updateUser(editing.id, { display_name: formDisplayName, role: formRole });
        notifications.show({ title: 'Updated', message: 'User updated', color: 'green' });
      } else {
        if (!formPassword) {
          notifications.show({ title: 'Error', message: 'Password required for new users', color: 'red' });
          return;
        }
        await createUser(formUsername, formDisplayName, formPassword, formRole);
        notifications.show({ title: 'Created', message: 'User created', color: 'green' });
      }
      setModalOpen(false);
      loadUsers();
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.response?.data?.error || 'Save failed',
        color: 'red',
      });
    }
  };

  const toggleActive = async (u: User) => {
    try {
      await updateUser(u.id, { is_active: u.is_active ? 0 : 1 });
      loadUsers();
    } catch {
      notifications.show({ title: 'Error', message: 'Update failed', color: 'red' });
    }
  };

  const roleColor: Record<string, string> = {
    admin: 'red', sales: 'blue', viewer: 'gray',
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Users</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Add User
        </Button>
      </Group>

      <Card shadow="sm" radius="md" withBorder p={0}>
        {loading ? (
          <Group justify="center" p="xl"><Loader /></Group>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Username</Table.Th>
                <Table.Th>Display Name</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th ta="center">Active</Table.Th>
                <Table.Th ta="center">Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.map((u) => (
                <Table.Tr key={u.id}>
                  <Table.Td><Text size="sm" fw={500}>{u.username}</Text></Table.Td>
                  <Table.Td>{u.display_name}</Table.Td>
                  <Table.Td>
                    <Badge color={roleColor[u.role] || 'gray'} variant="light">
                      {u.role}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="center">
                    <Switch
                      checked={!!u.is_active}
                      onChange={() => toggleActive(u)}
                      size="sm"
                    />
                  </Table.Td>
                  <Table.Td ta="center">
                    <ActionIcon variant="subtle" onClick={() => openEdit(u)}>
                      <IconEdit size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit User' : 'Add User'}
      >
        <Stack>
          <TextInput
            label="Username"
            required
            value={formUsername}
            onChange={(e) => setFormUsername(e.target.value)}
            disabled={!!editing}
          />
          <TextInput
            label="Display Name"
            required
            value={formDisplayName}
            onChange={(e) => setFormDisplayName(e.target.value)}
          />
          {!editing && (
            <PasswordInput
              label="Password"
              required
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
            />
          )}
          <Select
            label="Role"
            required
            data={[
              { value: 'admin', label: 'Admin / Engineer' },
              { value: 'sales', label: 'Sales / Designer' },
              { value: 'viewer', label: 'Viewer' },
            ]}
            value={formRole}
            onChange={(v) => setFormRole(v || 'sales')}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Update' : 'Create'}</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
