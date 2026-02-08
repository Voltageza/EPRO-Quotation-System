import { useState, useEffect } from 'react';
import {
  Title, Card, Stack, NumberInput, Button, Group, Text, Divider, Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { getPricing, updatePricing } from '../../api/admin.api';

export default function PricingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pricingFactor, setPricingFactor] = useState(0.72);
  const [vatRate, setVatRate] = useState(0.15);
  const [minMargin, setMinMargin] = useState(0.15);
  const [travelRate, setTravelRate] = useState(4.95);
  const [labourRate, setLabourRate] = useState(495);

  useEffect(() => {
    getPricing().then((p) => {
      setPricingFactor(p.pricing_factor);
      setVatRate(p.vat_rate);
      setMinMargin(p.min_margin);
      setTravelRate(p.travel_rate / 100); // cents to rands
      setLabourRate(p.labour_rate / 100);
      setLoading(false);
    }).catch(() => {
      notifications.show({ title: 'Error', message: 'Failed to load pricing', color: 'red' });
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePricing({
        pricing_factor: pricingFactor,
        vat_rate: vatRate,
        min_margin: minMargin,
        travel_rate: Math.round(travelRate * 100),
        labour_rate: Math.round(labourRate * 100),
      });
      notifications.show({ title: 'Saved', message: 'Pricing configuration updated', color: 'green' });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to save pricing', color: 'red' });
    }
    setSaving(false);
  };

  if (loading) return <Group justify="center" p="xl"><Loader /></Group>;

  return (
    <Stack>
      <Title order={2}>Pricing Configuration</Title>

      <Card shadow="sm" padding="lg" radius="md" withBorder maw={500}>
        <Stack>
          <div>
            <Text fw={600} mb="xs">Global Pricing Factor</Text>
            <Text size="sm" c="dimmed" mb="xs">
              Multiplied against retail price to get selling price. Default: 0.72 (28% markup from cost)
            </Text>
            <NumberInput
              value={pricingFactor}
              onChange={(v) => setPricingFactor(typeof v === 'number' ? v : 0.72)}
              decimalScale={4}
              step={0.01}
              min={0.01}
              max={2.0}
            />
          </div>

          <Divider />

          <div>
            <Text fw={600} mb="xs">VAT Rate</Text>
            <Text size="sm" c="dimmed" mb="xs">
              South African VAT (15%). Applied on subtotal, never on individual lines.
            </Text>
            <NumberInput
              value={vatRate}
              onChange={(v) => setVatRate(typeof v === 'number' ? v : 0.15)}
              decimalScale={4}
              step={0.01}
              min={0}
              max={1}
              suffix="%"
            />
          </div>

          <Divider />

          <div>
            <Text fw={600} mb="xs">Minimum Margin</Text>
            <Text size="sm" c="dimmed" mb="xs">
              Warning triggered if a line item falls below this margin.
            </Text>
            <NumberInput
              value={minMargin}
              onChange={(v) => setMinMargin(typeof v === 'number' ? v : 0.15)}
              decimalScale={4}
              step={0.01}
              min={0}
              max={1}
            />
          </div>

          <Divider />

          <div>
            <Text fw={600} mb="xs">Labour Rate (R/hr)</Text>
            <NumberInput
              prefix="R "
              value={labourRate}
              onChange={(v) => setLabourRate(typeof v === 'number' ? v : 495)}
              decimalScale={2}
              min={0}
            />
          </div>

          <div>
            <Text fw={600} mb="xs">Travel Rate (R/km)</Text>
            <NumberInput
              prefix="R "
              value={travelRate}
              onChange={(v) => setTravelRate(typeof v === 'number' ? v : 4.95)}
              decimalScale={2}
              min={0}
            />
          </div>

          <Group justify="flex-end" mt="md">
            <Button onClick={handleSave} loading={saving}>
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
