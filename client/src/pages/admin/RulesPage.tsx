import { useState, useEffect } from 'react';
import {
  Title, Card, Stack, Table, Text, Badge, Group, Loader,
  Accordion, Code, JsonInput, Button,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import api from '../../api/client';

interface RuleTable {
  id: number;
  rule_type: string;
  version: number;
  description: string;
  is_active: number;
  created_at: string;
}

interface RuleEntry {
  id: number;
  rule_table_id: number;
  system_class: string | null;
  condition_json: string;
  result_json: string;
  sort_order: number;
}

const typeColor: Record<string, string> = {
  dc_battery_cable: 'red',
  ac_cable: 'orange',
  ac_protection: 'yellow',
  labour: 'blue',
  mounting: 'teal',
};

export default function RulesPage() {
  const [rules, setRules] = useState<RuleTable[]>([]);
  const [entries, setEntries] = useState<Record<number, RuleEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<number | null>(null);
  const [editJson, setEditJson] = useState('');

  useEffect(() => {
    api.get('/admin/rules')
      .then(({ data }) => setRules(data.rules))
      .catch(() => notifications.show({ title: 'Error', message: 'Failed to load rules', color: 'red' }))
      .finally(() => setLoading(false));
  }, []);

  const loadEntries = async (tableId: number) => {
    if (entries[tableId]) return;
    try {
      const { data } = await api.get(`/admin/rules/${tableId}/entries`);
      setEntries((prev) => ({ ...prev, [tableId]: data.entries }));
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load rule entries', color: 'red' });
    }
  };

  const saveEntry = async (entryId: number, tableId: number) => {
    try {
      JSON.parse(editJson);
    } catch {
      notifications.show({ title: 'Error', message: 'Invalid JSON', color: 'red' });
      return;
    }
    try {
      await api.patch(`/admin/rules/entries/${entryId}`, { result_json: editJson });
      notifications.show({ title: 'Saved', message: 'Rule entry updated', color: 'green' });
      setEditingEntry(null);
      // Reload entries
      const { data } = await api.get(`/admin/rules/${tableId}/entries`);
      setEntries((prev) => ({ ...prev, [tableId]: data.entries }));
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to save', color: 'red' });
    }
  };

  if (loading) return <Group justify="center" p="xl"><Loader /></Group>;

  return (
    <Stack>
      <Title order={2}>Rule Tables</Title>
      <Text c="dimmed" size="sm">
        Rule tables define the Victron design rules used by the BoM generator. Edit JSON carefully — changes take effect immediately.
      </Text>

      <Accordion variant="separated">
        {rules.map((rule) => (
          <Accordion.Item key={rule.id} value={String(rule.id)}>
            <Accordion.Control onClick={() => loadEntries(rule.id)}>
              <Group>
                <Badge color={typeColor[rule.rule_type] || 'gray'} variant="light">
                  {rule.rule_type}
                </Badge>
                <Text fw={500}>{rule.description || rule.rule_type}</Text>
                <Badge variant="outline" size="sm">v{rule.version}</Badge>
                <Badge color={rule.is_active ? 'green' : 'gray'} size="sm">
                  {rule.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              {!entries[rule.id] ? (
                <Group justify="center" p="md"><Loader size="sm" /></Group>
              ) : entries[rule.id].length === 0 ? (
                <Text c="dimmed" size="sm">No entries</Text>
              ) : (
                <Card shadow="xs" radius="md" withBorder p={0}>
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th w={80}>Order</Table.Th>
                        <Table.Th w={100}>Class</Table.Th>
                        <Table.Th>Condition</Table.Th>
                        <Table.Th>Result</Table.Th>
                        <Table.Th w={80}>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {entries[rule.id].map((entry) => (
                        <Table.Tr key={entry.id}>
                          <Table.Td>{entry.sort_order}</Table.Td>
                          <Table.Td>
                            {entry.system_class ? (
                              <Badge size="sm" variant="light">{entry.system_class}</Badge>
                            ) : '—'}
                          </Table.Td>
                          <Table.Td>
                            <Code block style={{ maxHeight: 100, overflow: 'auto', fontSize: 11 }}>
                              {entry.condition_json}
                            </Code>
                          </Table.Td>
                          <Table.Td>
                            {editingEntry === entry.id ? (
                              <Stack gap="xs">
                                <JsonInput
                                  value={editJson}
                                  onChange={setEditJson}
                                  formatOnBlur
                                  autosize
                                  minRows={3}
                                  maxRows={10}
                                />
                                <Group gap="xs">
                                  <Button size="xs" onClick={() => saveEntry(entry.id, rule.id)}>Save</Button>
                                  <Button size="xs" variant="subtle" onClick={() => setEditingEntry(null)}>Cancel</Button>
                                </Group>
                              </Stack>
                            ) : (
                              <Code block style={{ maxHeight: 100, overflow: 'auto', fontSize: 11 }}>
                                {entry.result_json}
                              </Code>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {editingEntry !== entry.id && (
                              <Button
                                size="xs"
                                variant="subtle"
                                onClick={() => {
                                  setEditingEntry(entry.id);
                                  setEditJson(entry.result_json);
                                }}
                              >
                                Edit
                              </Button>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Card>
              )}
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Stack>
  );
}
