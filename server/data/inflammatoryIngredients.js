// Curated database of inflammatory ingredients relevant to autism research.
// Sources: Feingold Association, TACA dietary guidelines, peer-reviewed research
// on gut-brain axis, excitotoxins, and elimination diets (GFCF, SCD).

const SEVERITY = {
  HIGH: 'high',
  MODERATE: 'moderate',
};

const ingredients = [
  // --- Artificial Dyes ---
  {
    id: 'red40',
    names: ['red 40', 'red40', 'allura red', 'fd&c red 40', 'fd&c red no. 40', 'red dye 40'],
    category: 'Artificial Dye',
    severity: SEVERITY.HIGH,
    flag: 'Artificial Dye — Red 40',
    explanation:
      'Red 40 (Allura Red) is a petroleum-derived dye linked to hyperactivity and behavioral changes in children. The Feingold Association and multiple European studies associate it with increased ADHD symptoms. Often removed from diets in autism intervention programs.',
  },
  {
    id: 'yellow5',
    names: ['yellow 5', 'yellow5', 'tartrazine', 'fd&c yellow 5', 'fd&c yellow no. 5'],
    category: 'Artificial Dye',
    severity: SEVERITY.HIGH,
    flag: 'Artificial Dye — Yellow 5',
    explanation:
      'Tartrazine (Yellow 5) is associated with hyperactivity and allergic reactions in sensitive children. Required to carry a warning label in the EU. Commonly targeted in autism elimination diets.',
  },
  {
    id: 'yellow6',
    names: ['yellow 6', 'yellow6', 'sunset yellow', 'fd&c yellow 6', 'fd&c yellow no. 6'],
    category: 'Artificial Dye',
    severity: SEVERITY.HIGH,
    flag: 'Artificial Dye — Yellow 6',
    explanation:
      'Sunset Yellow (Yellow 6) is a coal tar dye linked to behavioral changes and hypersensitivity reactions. Part of the "Southampton Six" dyes that prompted EU warning labels.',
  },
  {
    id: 'blue1',
    names: ['blue 1', 'blue1', 'brilliant blue', 'fd&c blue 1', 'fd&c blue no. 1'],
    category: 'Artificial Dye',
    severity: SEVERITY.MODERATE,
    flag: 'Artificial Dye — Blue 1',
    explanation:
      'Brilliant Blue (Blue 1) is a synthetic dye that may cross the blood-brain barrier in some studies. Commonly avoided in autism-supportive diets as a precautionary measure.',
  },
  {
    id: 'blue2',
    names: ['blue 2', 'blue2', 'indigo carmine', 'fd&c blue 2', 'fd&c blue no. 2'],
    category: 'Artificial Dye',
    severity: SEVERITY.MODERATE,
    flag: 'Artificial Dye — Blue 2',
    explanation:
      'Indigo Carmine (Blue 2) is a synthetic dye. Research suggests possible neurological effects at high doses. Avoided in Feingold and autism elimination diets.',
  },
  {
    id: 'red3',
    names: ['red 3', 'red3', 'erythrosine', 'fd&c red 3', 'fd&c red no. 3'],
    category: 'Artificial Dye',
    severity: SEVERITY.HIGH,
    flag: 'Artificial Dye — Red 3',
    explanation:
      'Erythrosine (Red 3) is a coal tar dye banned in cosmetics but still permitted in food. Linked to thyroid disruption and behavioral effects. High priority for removal in autism-supportive diets.',
  },
  {
    id: 'green3',
    names: ['green 3', 'green3', 'fast green', 'fd&c green 3', 'fd&c green no. 3'],
    category: 'Artificial Dye',
    severity: SEVERITY.MODERATE,
    flag: 'Artificial Dye — Green 3',
    explanation:
      'Fast Green (Green 3) is a synthetic dye with limited safety data. Avoided in Feingold protocol and autism elimination diets as a precautionary measure.',
  },

  // --- Preservatives ---
  {
    id: 'bha',
    names: ['bha', 'butylated hydroxyanisole'],
    category: 'Preservative',
    severity: SEVERITY.HIGH,
    flag: 'Preservative — BHA',
    explanation:
      'BHA (Butylated Hydroxyanisole) is a synthetic antioxidant preservative. Classified as a possible human carcinogen by the NTP. Linked to behavioral disruption and endocrine interference. High priority for removal in autism dietary interventions.',
  },
  {
    id: 'bht',
    names: ['bht', 'butylated hydroxytoluene'],
    category: 'Preservative',
    severity: SEVERITY.HIGH,
    flag: 'Preservative — BHT',
    explanation:
      'BHT (Butylated Hydroxytoluene) is a petroleum-derived preservative associated with hyperactivity in children. The Feingold Association recommends strict avoidance. Some research links it to liver and kidney effects.',
  },
  {
    id: 'sodiumbenzoate',
    names: ['sodium benzoate', 'benzoate of soda', 'e211'],
    category: 'Preservative',
    severity: SEVERITY.HIGH,
    flag: 'Preservative — Sodium Benzoate',
    explanation:
      'Sodium benzoate, when combined with Vitamin C, can form benzene (a known carcinogen). The McCann Southampton study directly linked it to increased hyperactivity in children. One of the most widely flagged preservatives in autism dietary literature.',
  },
  {
    id: 'tbhq',
    names: ['tbhq', 'tertiary butylhydroquinone', 't-butylhydroquinone'],
    category: 'Preservative',
    severity: SEVERITY.HIGH,
    flag: 'Preservative — TBHQ',
    explanation:
      'TBHQ (Tertiary Butylhydroquinone) is a petroleum-derived preservative. Animal studies show neurological effects at high doses. Commonly avoided in autism elimination diets.',
  },
  {
    id: 'sodiumnitrate',
    names: ['sodium nitrate', 'sodium nitrite', 'potassium nitrate', 'potassium nitrite'],
    category: 'Preservative',
    severity: SEVERITY.MODERATE,
    flag: 'Preservative — Nitrates/Nitrites',
    explanation:
      'Nitrates and nitrites can convert to nitrosamines in the body, which are carcinogenic. Some research links them to inflammatory gut responses. Commonly avoided in autism-supportive nutrition plans.',
  },

  // --- Excitotoxins ---
  {
    id: 'msg',
    names: [
      'msg',
      'monosodium glutamate',
      'glutamic acid',
      'glutamate',
      'monopotassium glutamate',
      'hydrolyzed protein',
      'autolyzed yeast',
      'yeast extract',
    ],
    category: 'Excitotoxin',
    severity: SEVERITY.HIGH,
    flag: 'Excitotoxin — MSG / Glutamate',
    explanation:
      'MSG and other free glutamate sources are excitotoxins that overstimulate neuroreceptors. Research by Dr. Russell Blaylock and others suggests heightened sensitivity in children with autism. Can appear under many names including "yeast extract" and "hydrolyzed protein."',
  },
  {
    id: 'aspartame',
    names: ['aspartame', 'nutrasweet', 'equal', 'aminosweet', 'phenylalanine'],
    category: 'Excitotoxin',
    severity: SEVERITY.HIGH,
    flag: 'Excitotoxin — Aspartame',
    explanation:
      'Aspartame breaks down into phenylalanine, aspartic acid (an excitotoxin), and methanol. Children with PKU cannot metabolize phenylalanine safely. Widely flagged in autism dietary literature for potential neurological effects.',
  },
  {
    id: 'naturalflavors',
    names: ['natural flavors', 'natural flavor', 'natural flavoring'],
    category: 'Excitotoxin',
    severity: SEVERITY.MODERATE,
    flag: 'Ambiguous — Natural Flavors',
    explanation:
      '"Natural flavors" is an FDA catch-all term that can legally contain free glutamates (excitotoxins), MSG derivatives, and other compounds not individually disclosed. Families managing autism often avoid this ingredient due to lack of transparency.',
  },

  // --- Artificial Sweeteners ---
  {
    id: 'sucralose',
    names: ['sucralose', 'splenda'],
    category: 'Artificial Sweetener',
    severity: SEVERITY.MODERATE,
    flag: 'Artificial Sweetener — Sucralose',
    explanation:
      'Sucralose can disrupt gut microbiome composition, which is particularly relevant for children with autism given the strong gut-brain axis connection. Some research links it to reduced beneficial bacteria.',
  },
  {
    id: 'acesulfamek',
    names: ['acesulfame k', 'acesulfame potassium', 'ace-k', 'sunett', 'sweet one'],
    category: 'Artificial Sweetener',
    severity: SEVERITY.MODERATE,
    flag: 'Artificial Sweetener — Acesulfame-K',
    explanation:
      'Acesulfame potassium has limited long-term safety data. Animal studies suggest possible effects on cognitive function. Avoided in autism-supportive diets as a precautionary measure.',
  },
  {
    id: 'saccharin',
    names: ['saccharin', 'sodium saccharin', 'sweet n low'],
    category: 'Artificial Sweetener',
    severity: SEVERITY.MODERATE,
    flag: 'Artificial Sweetener — Saccharin',
    explanation:
      'Saccharin is the oldest artificial sweetener and has a checkered safety history. Like sucralose, it may negatively affect gut flora. Generally avoided in autism elimination diets.',
  },

  // --- High Fructose Corn Syrup ---
  {
    id: 'hfcs',
    names: [
      'high fructose corn syrup',
      'high-fructose corn syrup',
      'hfcs',
      'corn syrup',
      'fructose',
      'glucose-fructose syrup',
    ],
    category: 'Sweetener',
    severity: SEVERITY.MODERATE,
    flag: 'Sweetener — High Fructose Corn Syrup',
    explanation:
      'HFCS drives systemic inflammation and disrupts gut microbiome health. Many conventional HFCS sources have tested positive for mercury contamination. Strongly associated with inflammatory responses in children.',
  },

  // --- Gluten (GFCF diet) ---
  {
    id: 'gluten',
    names: [
      'wheat',
      'wheat flour',
      'whole wheat',
      'wheat starch',
      'barley',
      'rye',
      'malt',
      'malt extract',
      'malt flavoring',
      'spelt',
      'triticale',
      'semolina',
      'farro',
      'kamut',
      'durum',
      'gluten',
    ],
    category: 'Gluten',
    severity: SEVERITY.MODERATE,
    flag: 'Gluten Source',
    explanation:
      'Many children with autism have increased intestinal permeability ("leaky gut"), allowing gluten-derived peptides (gliadorphins) to enter the bloodstream and potentially cross the blood-brain barrier, affecting behavior and cognition. The GFCF diet is one of the most widely studied dietary interventions for autism.',
  },

  // --- Casein (GFCF diet) ---
  {
    id: 'casein',
    names: [
      'casein',
      'caseinate',
      'sodium caseinate',
      'calcium caseinate',
      'milk',
      'milk powder',
      'skim milk',
      'whey',
      'whey protein',
      'lactose',
      'lactalbumin',
      'lactoferrin',
    ],
    negators: ['coconut', 'oat', 'almond', 'soy', 'rice', 'cashew', 'hemp', 'pea', 'flax'],
    category: 'Casein / Dairy',
    severity: SEVERITY.MODERATE,
    flag: 'Casein / Dairy Source',
    explanation:
      'Casein from dairy breaks down into casomorphins, opioid-like peptides that may affect behavior and cognition in children with leaky gut. The GFCF (gluten-free, casein-free) diet is a cornerstone of many autism nutrition interventions.',
  },

  // --- Carrageenan ---
  {
    id: 'carrageenan',
    names: ['carrageenan', 'carrageenan gum'],
    category: 'Additive',
    severity: SEVERITY.HIGH,
    flag: 'Additive — Carrageenan',
    explanation:
      'Carrageenan is a seaweed-derived thickener that consistently causes intestinal inflammation in research models. It is particularly problematic for children with compromised gut health, which overlaps heavily with the autism population.',
  },

  // --- Soy ---
  {
    id: 'soy',
    names: [
      'soy',
      'soya',
      'soybean',
      'soy protein',
      'soy lecithin',
      'textured vegetable protein',
      'tvp',
      'edamame',
      'tofu',
      'tempeh',
      'miso',
    ],
    category: 'Soy',
    severity: SEVERITY.MODERATE,
    flag: 'Soy / Phytoestrogen Source',
    explanation:
      'Soy contains phytoestrogens that may interfere with hormonal regulation. Many children with autism also have soy sensitivity. Soy is a top-8 allergen and is avoided in several autism elimination diets. Note: soy lecithin is often tolerated but flagged here for awareness.',
  },

  // --- Artificial Flavors ---
  {
    id: 'artificialflavors',
    names: ['artificial flavor', 'artificial flavors', 'artificial flavoring'],
    category: 'Artificial Additive',
    severity: SEVERITY.MODERATE,
    flag: 'Artificial Flavors',
    explanation:
      'Artificial flavors are synthetic chemical compounds. The Feingold protocol specifically targets artificial flavors as behavioral triggers. Many contain compounds not individually disclosed on labels.',
  },

  // --- Aluminum Additives ---
  {
    id: 'aluminum',
    names: [
      'sodium aluminum sulfate',
      'sodium aluminosilicate',
      'aluminum',
      'alum',
      'aluminum phosphate',
    ],
    category: 'Heavy Metal Risk',
    severity: SEVERITY.HIGH,
    flag: 'Aluminum Additive',
    explanation:
      'Aluminum-based food additives raise concern for children who may have impaired detoxification pathways, a factor studied in autism research. Aluminum accumulation has been associated with neuroinflammation.',
  },
];

module.exports = ingredients;
