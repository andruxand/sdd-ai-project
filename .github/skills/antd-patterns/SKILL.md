````skill
---
name: antd-patterns
description: Ant Design v5 — ConfigProvider/theme tokens, Form/Form.Item patterns, layout primitives (Space/Flex/Grid), Table, useToken hook, dark/compact algorithms, and Storybook integration. Apply when ui_library = 'antd'.
type: conditional
condition: ui_library == 'antd'
agents: [frontend-implementer, tester-frontend]
---

## Prerequisite: verify ui_library

Read `ui_library` from `openspec/config.yaml` before styling anything.
This skill applies **only** when `ui_library: 'antd'`. If the value is different, stop and use the correct skill.

---

## 1. Stack

```bash
# installed by bootstrap
antd @ant-design/icons
````

Ant Design v5 ships with its own TypeScript types. No separate `@types/antd` needed.

---

## 2. App root — `ConfigProvider` + `App` wrapper

```typescript
// apps/web/src/main.tsx
import ReactDOM from 'react-dom/client';
import { ConfigProvider, App as AntdApp, theme as antdTheme } from 'antd';
import appTheme from '@/app/theme';
import { AppRoot } from '@/app/AppRoot';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ConfigProvider theme={appTheme}>
    {/*
      <App> exposes message/notification/modal APIs via hooks.
      Must wrap the entire app to avoid static function warnings.
    */}
    <AntdApp>
      <AppRoot />
    </AntdApp>
  </ConfigProvider>,
);
```

---

## 3. Theme configuration — `app/theme.ts`

All design tokens live in a single `ConfigProvider theme` object. Never set styles per-component.

```typescript
// apps/web/src/app/theme.ts
import { type ThemeConfig, theme as antdTheme } from 'antd';

const appTheme: ThemeConfig = {
  // Pick one algorithm (or compose them):
  // antdTheme.defaultAlgorithm  — standard light mode
  // antdTheme.darkAlgorithm     — dark mode
  // antdTheme.compactAlgorithm  — compact density
  algorithm: antdTheme.defaultAlgorithm,

  token: {
    // --- Color ---
    colorPrimary: '#2563eb',
    colorSuccess: '#16a34a',
    colorWarning: '#f59e0b',
    colorError: '#dc2626',
    colorInfo: '#0ea5e9',

    // --- Typography ---
    fontFamily: '"Inter", system-ui, sans-serif',
    fontSize: 14,
    fontSizeLG: 16,
    lineHeight: 1.6,

    // --- Border ---
    borderRadius: 8,
    borderRadiusLG: 12,

    // --- Spacing ---
    // Ant Design derives component spacing from these
    padding: 16,
    paddingLG: 24,
    paddingSM: 12,
    paddingXS: 8,

    // --- Motion ---
    motionDurationMid: '0.2s',
  },

  // Component-level token overrides
  components: {
    Button: {
      primaryColor: '#ffffff',
      borderRadius: 8,
    },
    Input: {
      borderRadius: 8,
    },
    Card: {
      borderRadius: 12,
    },
    Table: {
      borderRadius: 8,
      headerBg: '#f8fafc',
    },
  },
};

export default appTheme;
```

---

## 4. Dark mode

```typescript
// apps/web/src/app/theme.ts
import { theme as antdTheme, type ThemeConfig } from 'antd';

export function createAntdTheme(dark: boolean): ThemeConfig {
  return {
    algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: '#2563eb',
      fontFamily: '"Inter", system-ui, sans-serif',
      borderRadius: 8,
    },
  };
}
```

```typescript
// App root with toggle
const [dark, setDark] = useState(false);
const theme = useMemo(() => createAntdTheme(dark), [dark]);

<ConfigProvider theme={theme}>
  <AntdApp>
    <AppRoot toggleDark={() => setDark((d) => !d)} />
  </AntdApp>
</ConfigProvider>
```

---

## 5. `useToken` — access design tokens in components

```typescript
// ✅ read tokens programmatically — do not hardcode
import { theme as antdTheme } from 'antd';

function StatusChip({ status }: { status: 'active' | 'inactive' }) {
  const { token } = antdTheme.useToken();

  return (
    <span
      style={{
        backgroundColor:
          status === 'active'
            ? token.colorSuccessBg
            : token.colorFillQuaternary,
        color: status === 'active' ? token.colorSuccess : token.colorTextSecondary,
        borderRadius: token.borderRadius,
        padding: `${token.paddingXXS}px ${token.paddingXS}px`,
        fontSize: token.fontSizeSM,
      }}
    >
      {status}
    </span>
  );
}
```

> Note: `useToken()` is the correct way to access tokens in components. Do NOT hardcode hex values.

---

## 6. Forms — `<Form>` + `<Form.Item>`

```typescript
import { Form, Input, Select, Button, type FormProps } from 'antd';
import { z } from 'zod';

// Define schema separately for backend-compatible validation
const CreateOrderSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  quantity: z.number().int().positive('Must be at least 1').max(100),
});
type CreateOrderValues = z.infer<typeof CreateOrderSchema>;

export function CreateOrderForm({ onSuccess }: { onSuccess: () => void }) {
  const [form] = Form.useForm<CreateOrderValues>();
  const { message } = AntdApp.useApp(); // ✅ via App context — not message.success()

  const onFinish: FormProps<CreateOrderValues>['onFinish'] = async (values) => {
    try {
      const parsed = CreateOrderSchema.parse(values);
      await submitOrder(parsed);
      message.success('Order created');
      form.resetFields();
      onSuccess();
    } catch (e) {
      message.error('Failed to create order');
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onFinish}
      initialValues={{ quantity: 1 }}
    >
      <Form.Item
        name="customerId"
        label="Customer"
        rules={[{ required: true, message: 'Customer is required' }]}
      >
        <Select placeholder="Select a customer" />
      </Form.Item>
      <Form.Item
        name="quantity"
        label="Quantity"
        rules={[
          { required: true },
          { type: 'number', min: 1, max: 100 },
        ]}
      >
        <Input type="number" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit">
          Create Order
        </Button>
      </Form.Item>
    </Form>
  );
}
```

---

## 7. Layout primitives

| Need                            | Use                                                                   |
| ------------------------------- | --------------------------------------------------------------------- |
| Inline spacing between elements | `<Space size="small\|middle\|large">` or `<Space size={[h, v]} wrap>` |
| Flex layout (Ant Design v5.10+) | `<Flex gap="middle" align="center" justify="space-between">`          |
| 24-column grid                  | `<Row gutter={[16, 16]}><Col span={12} xs={24} md={12}>`              |
| Page skeleton                   | `<Layout><Layout.Header>…<Layout.Content>…<Layout.Footer>`            |

```typescript
// ✅ correct layout
<Flex gap="large" align="flex-start">
  <Card title="Details" style={{ flex: 1 }}>
    <OrderDetails order={order} />
  </Card>
  <Card title="Summary" style={{ width: 280 }}>
    <OrderSummary order={order} />
  </Card>
</Flex>

// ❌ raw CSS flexbox bypassing layout primitives
<div style={{ display: 'flex', gap: 24 }}>
```

---

## 8. Table

```typescript
import { Table, type ColumnsType } from 'antd';

interface OrderRow {
  id: string;
  customerName: string;
  total: number;
  status: 'active' | 'complete' | 'cancelled';
}

const columns: ColumnsType<OrderRow> = [
  {
    title: 'Order ID',
    dataIndex: 'id',
    key: 'id',
    sorter: (a, b) => a.id.localeCompare(b.id),
  },
  {
    title: 'Customer',
    dataIndex: 'customerName',
    key: 'customerName',
  },
  {
    title: 'Total',
    dataIndex: 'total',
    key: 'total',
    render: (v: number) => `$${v.toFixed(2)}`,
    align: 'right',
  },
];

<Table<OrderRow>
  columns={columns}
  dataSource={orders}
  rowKey="id"             // ✅ always specify rowKey — not index
  loading={isLoading}
  pagination={{ pageSize: 20, showSizeChanger: true }}
  scroll={{ x: 'max-content' }} // ✅ horizontal scroll for mobile
/>
```

---

## 9. Icons

```typescript
// ✅ from @ant-design/icons only
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';

<Button type="primary" icon={<PlusOutlined />}>
  Add Order
</Button>
```

Never mix `@ant-design/icons` with `@mui/icons-material` or other icon libraries.

---

## 10. Message / Notification / Modal

```typescript
// ✅ always via App context hooks — NOT static methods
import { App as AntdApp } from 'antd';

function OrderActions() {
  const { message, notification, modal } = AntdApp.useApp();

  const handleDelete = () => {
    modal.confirm({
      title: 'Delete order?',
      content: 'This action cannot be undone.',
      onOk: async () => {
        await deleteOrder(id);
        message.success('Order deleted');
      },
    });
  };
}

// ❌ static method — deprecated pattern, doesn't respect ConfigProvider theme
import { message } from 'antd';
message.success('Done'); // DON'T DO THIS
```

---

## 11. Storybook integration

```typescript
// .storybook/preview.tsx
import { ConfigProvider, App as AntdApp } from 'antd';
import appTheme from '../src/app/theme';
import type { Decorator } from '@storybook/react';

export const withAntd: Decorator = (Story) => (
  <ConfigProvider theme={appTheme}>
    <AntdApp>
      <Story />
    </AntdApp>
  </ConfigProvider>
);

export const decorators = [withAntd];
```

---

## 12. Mandatory guardrails

| Rule                                                          | Rationale                         |
| ------------------------------------------------------------- | --------------------------------- |
| All tokens in `ConfigProvider theme` in `app/theme.ts`        | One source of truth               |
| No inline `style` for color/spacing values — use `useToken()` | Token-based, theme-switchable     |
| `App.useApp()` for message/notification/modal                 | Respects ConfigProvider context   |
| `rowKey` on every `<Table>`                                   | Required for React reconciliation |
| Icons from `@ant-design/icons` only                           | No library mixing                 |
| No CSS Modules or Tailwind alongside Ant Design               | One approach per project          |

```

```
