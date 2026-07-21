// Canonical category keys used by the matcher, presets, and profile editor.
const CATEGORIES = [
  { key: 'dyes', label: 'Artificial Dyes', description: 'Synthetic food coloring (Red 40, Yellow 5, Blue 1, etc.). Common in brightly colored sauces, candies, sodas, frostings.' },
  { key: 'preservatives', label: 'Preservatives', description: 'Chemical preservatives like sodium benzoate, BHA/BHT, nitrates/nitrites. Common in cured meats, packaged sauces.' },
  { key: 'excitotoxins', label: 'MSG & Excitotoxins', description: 'MSG, hydrolyzed protein, autolyzed yeast. Common in Asian dishes, broths, gravies, seasoned/savory items.' },
  { key: 'sweeteners', label: 'Artificial Sweeteners', description: 'Aspartame, sucralose, saccharin. Common in "diet"/"sugar-free"/"zero" drinks and desserts.' },
  { key: 'hfcs', label: 'Added Sugars / HFCS', description: 'High-fructose corn syrup and added sugars. Common in BBQ/sweet sauces, glazes, sodas, desserts.' },
  { key: 'gluten', label: 'Gluten', description: 'Wheat-based gluten. Common in anything breaded, battered, floured, pasta, bread, soy sauce, most fried items.' },
  { key: 'dairy', label: 'Dairy / Casein', description: 'Milk, cheese, butter, cream, casein, whey. Common in creamy/Alfredo/cheese sauces, buttered items, most desserts.' },
  { key: 'soy', label: 'Soy', description: 'Soybeans, soy sauce, soy lecithin, edamame, tofu. Common in Asian dishes, fried foods, dressings.' },
  { key: 'artificial-flavors', label: 'Artificial Flavors', description: 'Synthetic flavorings ("natural and artificial flavors"). Common in processed/packaged components.' },
  { key: 'carrageenan', label: 'Carrageenan', description: 'Seaweed-derived thickener. Common in dairy/non-dairy creams, processed dairy, deli meats.' },
  { key: 'aluminum', label: 'Aluminum Additives', description: 'Aluminum-based additives (baking powder, anticaking agents). Common in baked goods, biscuits, some cheeses.' },
];
const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
module.exports = { CATEGORIES, CATEGORY_KEYS };
