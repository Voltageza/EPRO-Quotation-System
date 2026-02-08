import { useState, useEffect } from 'react';
import {
  Title, Table, Button, Group, TextInput, Select, NumberInput,
  Modal, Stack, Text, Badge, ActionIcon, Card, Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconEdit, IconTrash, IconSearch } from '@tabler/icons-react';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../../api/products.api';

interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  subcategory: string | null;
  unit: string;
  retail_price: number;
  is_active: number;
}

const CATEGORIES = [
  'panel', 'inverter', 'mppt', 'battery', 'cable', 'protection',
  'mounting', 'enclosure', 'accessory', 'labour', 'travel',
];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  // Form state
  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<string>('accessory');
  const [formUnit, setFormUnit] = useState('each');
  const [formPrice, setFormPrice] = useState<number>(0);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await getProducts(filterCategory || undefined);
      setProducts(data);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load products', color: 'red' });
    }
    setLoading(false);
  };

  useEffect(() => { loadProducts(); }, [filterCategory]);

  const openCreate = () => {
    setEditing(null);
    setFormSku(''); setFormName(''); setFormCategory('accessory');
    setFormUnit('each'); setFormPrice(0);
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setFormSku(p.sku); setFormName(p.name); setFormCategory(p.category);
    setFormUnit(p.unit); setFormPrice(p.retail_price / 100);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const priceCents = Math.round(formPrice * 100);
    try {
      if (editing) {
        await updateProduct(editing.id, {
          sku: formSku, name: formName, category: formCategory,
          unit: formUnit, retail_price: priceCents,
        });
        notifications.show({ title: 'Updated', message: `${formName} updated`, color: 'green' });
      } else {
        await createProduct({
          sku: formSku, name: formName, category: formCategory,
          unit: formUnit, retail_price: priceCents,
        });
        notifications.show({ title: 'Created', message: `${formName} created`, color: 'green' });
      }
      setModalOpen(false);
      loadProducts();
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.response?.data?.error || 'Save failed',
        color: 'red',
      });
    }
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`Deactivate "${p.name}"?`)) return;
    try {
      await deleteProduct(p.id);
      notifications.show({ title: 'Deleted', message: `${p.name} deactivated`, color: 'orange' });
      loadProducts();
    } catch {
      notifications.show({ title: 'Error', message: 'Delete failed', color: 'red' });
    }
  };

  const formatPrice = (cents: number) =>
    `R ${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Products</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Add Product
        </Button>
      </Group>

      <Group>
        <TextInput
          placeholder="Search products..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          w={300}
        />
        <Select
          placeholder="All categories"
          data={CATEGORIES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))}
          value={filterCategory}
          onChange={setFilterCategory}
          clearable
          w={200}
        />
        <Text size="sm" c="dimmed">{filtered.length} products</Text>
      </Group>

      <Card shadow="sm" radius="md" withBorder p={0}>
        {loading ? (
          <Group justify="center" p="xl"><Loader /></Group>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>SKU</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th>Unit</Table.Th>
                <Table.Th ta="right">Retail Price</Table.Th>
                <Table.Th ta="center">Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td><Text size="sm" fw={500}>{p.sku}</Text></Table.Td>
                  <Table.Td>{p.name}</Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light">{p.category}</Badge>
                  </Table.Td>
                  <Table.Td>{p.unit}</Table.Td>
                  <Table.Td ta="right">{formatPrice(p.retail_price)}</Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="center">
                      <ActionIcon variant="subtle" onClick={() => openEdit(p)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(p)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
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
        title={editing ? 'Edit Product' : 'Add Product'}
        size="md"
      >
        <Stack>
          <TextInput label="SKU" required value={formSku} onChange={(e) => setFormSku(e.target.value)} />
          <TextInput label="Name" required value={formName} onChange={(e) => setFormName(e.target.value)} />
          <Select
            label="Category"
            required
            data={CATEGORIES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))}
            value={formCategory}
            onChange={(v) => setFormCategory(v || 'accessory')}
          />
          <Select
            label="Unit"
            data={[
              { value: 'each', label: 'Each' },
              { value: 'm', label: 'Meter (m)' },
              { value: 'hr', label: 'Hour (hr)' },
              { value: 'km', label: 'Kilometer (km)' },
            ]}
            value={formUnit}
            onChange={(v) => setFormUnit(v || 'each')}
          />
          <NumberInput
            label="Retail Price (Rand)"
            required
            prefix="R "
            thousandSeparator=","
            decimalScale={2}
            min={0}
            value={formPrice}
            onChange={(v) => setFormPrice(typeof v === 'number' ? v : 0)}
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
