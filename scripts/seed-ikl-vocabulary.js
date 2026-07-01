/**
 * Seed the Industrial Knowledge Library with CONTROLLED VOCABULARY ONLY.
 *
 * This seeds the structural taxonomy taken verbatim from the MATRIYA IKL
 * specification — target company names, functional-mechanism names, and
 * application domains. It deliberately seeds NO chemistry, properties, CAS
 * numbers, or performance data: those are facts that must arrive with real
 * provenance. Every seeded row is bound to a clearly-labelled `matriya_seed`
 * source with low confidence and is meant to be enriched later.
 *
 * Idempotent: re-running does not duplicate rows (matched by name).
 *
 * Usage:  node scripts/seed-ikl-vocabulary.js
 */
import { initDb } from '../database.js';
import { IklSource, IklCompany, IklMechanism, IklApplication } from '../iklModels.js';
import logger from '../logger.js';

// From the specification's "Target Companies" list (names only).
const COMPANIES = [
  'BASF', 'Evonik', 'Dow', 'Wacker', 'Arkema', 'Sika', 'Mapei', 'Saint-Gobain',
  'Master Builders Solutions', 'BYK', 'Cabot', 'Clariant', 'Nouryon', 'Synthomer',
  'Eastman', 'Lanxess', 'Solenis', 'Omya', 'Imerys', 'Huntsman', 'Sherwin-Williams',
  'PPG', 'RPM', 'Covestro', 'Ashland'
];

// From "Layer 4 – Functional Mechanisms" examples (names only; principle enriched later).
const MECHANISMS = [
  'Water Repellency', 'Film Formation', 'Char Formation', 'Catalytic Dehydration',
  'Steric Stabilization', 'Electrostatic Repulsion', 'UV Protection', 'Crack Bridging',
  'Carbonation Resistance', 'Thermal Insulation', 'Expansion'
];

// From "Layer 5 – Applications" examples.
const APPLICATIONS = [
  'Concrete', 'Mortars', 'EIFS', 'Facades', 'Industrial Floors', 'Fire Protection',
  'Waterproofing', 'Historical Preservation', 'Infrastructure'
];

async function findOrCreate(model, where, defaults) {
  const existing = await model.findOne({ where });
  if (existing) return { row: existing, created: false };
  const row = await model.create({ ...where, ...defaults });
  return { row, created: true };
}

async function main() {
  await initDb();

  const { row: source, created: sourceCreated } = await findOrCreate(
    IklSource,
    { document_type: 'matriya_seed', title: 'MATRIYA IKL specification — controlled vocabulary' },
    {
      notes: 'Structural taxonomy seeded from the MATRIYA specification. Names only — no chemistry or measured data. Enrich with official sources.',
      confidence: 0.1
    }
  );
  logger.info(`Seed source ${sourceCreated ? 'created' : 'reused'} (id=${source.id})`);

  let companies = 0;
  for (const name of COMPANIES) {
    const { created } = await findOrCreate(IklCompany, { name }, { source_id: source.id, confidence: 0.1 });
    if (created) companies++;
  }

  let mechanisms = 0;
  for (const name of MECHANISMS) {
    const { created } = await findOrCreate(IklMechanism, { name }, { source_id: source.id, confidence: 0.1 });
    if (created) mechanisms++;
  }

  let applications = 0;
  for (const name of APPLICATIONS) {
    const { created } = await findOrCreate(IklApplication, { name }, { source_id: source.id, confidence: 0.1 });
    if (created) applications++;
  }

  logger.info(`IKL vocabulary seed complete: +${companies} companies, +${mechanisms} mechanisms, +${applications} applications`);
  logger.info('Note: scientific principles, properties and performance data intentionally left empty (require real provenance).');
  process.exit(0);
}

main().catch((e) => {
  logger.error(`IKL seed failed: ${e.message}`);
  process.exit(1);
});
