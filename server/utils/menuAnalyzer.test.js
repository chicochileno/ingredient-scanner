const { test } = require('node:test');
const assert = require('node:assert');
const { analyzeMenu, REPORT_MENU_TOOL } = require('./menuAnalyzer');

function fakeClient(toolInput, capture) {
  return {
    messages: {
      create: async (req) => {
        if (capture) capture.req = req;
        return { content: [{ type: 'tool_use', name: 'report_menu', input: toolInput }] };
      },
    },
  };
}

test('analyzeMenu returns the tool_use input dishes', async () => {
  const payload = { dishes: [{ name: 'Chicken Alfredo', categories: ['dairy'], allergens: [], note: 'creamy' }] };
  const capture = {};
  const dishes = await analyzeMenu('Chicken Alfredo\nSide Salad', {
    categories: [{ key: 'dairy', label: 'Dairy / Casein', description: 'milk, cream, cheese' }],
    allergenNames: ['Peanut'],
    client: fakeClient(payload, capture),
  });
  assert.deepStrictEqual(dishes, payload.dishes);

  // Uses Haiku, forces the report_menu tool, and marks the static system prefix cacheable.
  assert.strictEqual(capture.req.model, 'claude-haiku-4-5');
  assert.deepStrictEqual(capture.req.tool_choice, { type: 'tool', name: 'report_menu' });
  assert.strictEqual(capture.req.tools[0].name, 'report_menu');
  const staticBlock = capture.req.system.find((b) => b.cache_control);
  assert.ok(staticBlock, 'expected a cache_control block on the static system prefix');
});

test('analyzeMenu returns [] when no tool_use block is present', async () => {
  const client = { messages: { create: async () => ({ content: [{ type: 'text', text: 'no tools' }] }) } };
  const dishes = await analyzeMenu('menu', { categories: [], allergenNames: [], client });
  assert.deepStrictEqual(dishes, []);
});

test('REPORT_MENU_TOOL schema requires dishes with name/categories/allergens/note', () => {
  const props = REPORT_MENU_TOOL.input_schema.properties.dishes.items.properties;
  assert.ok(props.name && props.categories && props.allergens && props.note);
});
