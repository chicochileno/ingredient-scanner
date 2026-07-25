const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-haiku-4-5';

// Single tool that forces valid structured JSON out of the model.
const REPORT_MENU_TOOL = {
  name: 'report_menu',
  description: 'Report the likely concern categories and allergens for each dish on the menu.',
  input_schema: {
    type: 'object',
    properties: {
      dishes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'The dish name as printed on the menu.' },
            categories: {
              type: 'array',
              items: { type: 'string' },
              description: 'Canonical category keys this dish LIKELY contains given typical preparation.',
            },
            allergens: {
              type: 'array',
              items: { type: 'string' },
              description: 'Any of the provided custom allergen names this dish likely contains. Use the exact provided spelling.',
            },
            note: { type: 'string', description: 'One short phrase on why (e.g. "Alfredo = dairy"). May be empty.' },
          },
          required: ['name', 'categories', 'allergens', 'note'],
        },
      },
    },
    required: ['dishes'],
  },
};

const STATIC_INSTRUCTIONS =
  `You read restaurant menus and identify, for each dish, which concern categories it LIKELY contains ` +
  `given typical preparation — including hidden ingredients not printed on the menu (e.g. Alfredo → dairy; ` +
  `anything breaded/battered/fried → gluten; most Asian savory dishes → soy). Menus omit sub-ingredients, so ` +
  `reason from how the dish is normally made. Be reasonably inclusive about likely hidden ingredients, but do ` +
  `not invent concerns with no basis. You are estimating likelihood, never guaranteeing safety. Only use ` +
  `category keys from the provided list, and only use allergen names from the provided allergen list (exact spelling). ` +
  `Call the report_menu tool exactly once with one entry per distinct dish.`;

let defaultClient = null;
function getDefaultClient() {
  if (!defaultClient) defaultClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return defaultClient;
}

// categories: [{ key, label, description }], allergenNames: [str]
// Returns the raw dishes array from the tool call (unvalidated — caller sanitizes via parseMenuReport).
async function analyzeMenu(menuText, { categories, allergenNames, client } = {}) {
  const anthropic = client || getDefaultClient();

  const categoryLines = categories
    .map((c) => `- ${c.key} (${c.label}): ${c.description}`)
    .join('\n');
  const allergenList = allergenNames.length ? allergenNames.join(', ') : '(none)';

  // Static prefix (instructions + category definitions) is cache_control'd so it's
  // reused across scans; only the menu text + allergen list vary per request.
  const staticSystem =
    `${STATIC_INSTRUCTIONS}\n\nCONCERN CATEGORIES (use these keys):\n${categoryLines}`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [REPORT_MENU_TOOL],
    tool_choice: { type: 'tool', name: 'report_menu' },
    system: [
      { type: 'text', text: staticSystem, cache_control: { type: 'ephemeral' } },
    ],
    messages: [
      {
        role: 'user',
        content:
          `Custom allergen names to watch for: ${allergenList}\n\n` +
          `MENU:\n${menuText}`,
      },
    ],
  });

  const block = (response.content || []).find((b) => b.type === 'tool_use' && b.name === 'report_menu');
  if (!block || !block.input || !Array.isArray(block.input.dishes)) return [];
  return block.input.dishes;
}

module.exports = { analyzeMenu, REPORT_MENU_TOOL, MODEL };
