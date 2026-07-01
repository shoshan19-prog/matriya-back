/**
 * Industrial Knowledge Library (IKL) — Sequelize models.
 *
 * MATRIYA external scientific reference layer. Fully separated from Fresco
 * internal knowledge:
 *   - Every IKL table is namespaced with the `ikl_` prefix.
 *   - IKL never references Fresco internal tables (rag_documents, experiments,
 *     ...) with a foreign key. The only bridge is `ikl_connections`, which
 *     stores an OPAQUE textual reference to internal knowledge and stays a
 *     hypothesis until a human validates it. External knowledge can therefore
 *     never overwrite internal knowledge.
 *   - Every knowledge record carries provenance (`source_id` → `ikl_sources`).
 *     Layers that state facts require a source (enforced in iklEndpoints.js).
 *   - Writes are additive/audited: updates snapshot the previous version into
 *     `ikl_record_history`, preserving version history.
 *
 * Models are defined on the shared `sequelize` instance from database.js, so
 * `initDb()`'s `sequelize.sync({ alter: false })` creates any missing tables
 * without touching existing ones.
 */
import { DataTypes } from 'sequelize';
import { sequelize } from './database.js';

// Fixed guard value — every IKL knowledge record lives in the external domain.
export const KNOWLEDGE_DOMAIN_EXTERNAL = 'external';

// Controlled vocabularies (from the MATRIYA IKL specification).
export const RELATIONSHIP_TYPES = [
  'compatible_with',
  'competes_with',
  'alternative',
  'lower_cost_alternative',
  'premium_alternative',
  'incompatible_with',
  'synergy',
  'trade_off'
];

export const MECHANISM_RELATIONS = [
  'leads_to',
  'depends_on',
  'shares_mechanism',
  'cause_effect'
];

export const PERFORMANCE_SOURCE_KINDS = ['measured', 'manufacturer_claim'];

export const OPPORTUNITY_TYPES = [
  'technology_gap',
  'missing_product_category',
  'emerging_material',
  'patent_trend',
  'research_trend',
  'supplier_innovation',
  'new_functional_mechanism',
  'potential_collaboration'
];

export const CONNECTION_STATUS = ['hypothesis', 'validated', 'rejected'];

export const DOCUMENT_TYPES = [
  'official_website',
  'tds',
  'sds',
  'product_selector',
  'application_guide',
  'technical_manual',
  'white_paper',
  'patent',
  'standard',
  'scientific_paper',
  'benchmark_study',
  'technical_report',
  'lab_result',
  'matriya_seed'
];

// The subject types an IKL record can point at (used by cross-cutting layers).
export const SUBJECT_TYPES = [
  'company',
  'brand',
  'product',
  'raw_material',
  'mechanism',
  'application'
];

const def = sequelize
  ? (name, attributes, options = {}) =>
      sequelize.define(name, attributes, { timestamps: false, ...options })
  : () => null;

/** Columns shared by every knowledge record (provenance + versioning + domain guard). */
function knowledgeColumns(extra = {}, { sourceRequired = true } = {}) {
  return {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    // Provenance. No orphan knowledge: fact-stating layers require a source.
    source_id: { type: DataTypes.INTEGER, allowNull: !sourceRequired },
    confidence: { type: DataTypes.DECIMAL(5, 4), allowNull: true },
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    // Marks records that are inferred / not yet validated (Layer 14, connections).
    is_hypothesis: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // Domain guard — always 'external'. Kept explicit so a stray internal write is obvious.
    knowledge_domain: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: KNOWLEDGE_DOMAIN_EXTERNAL,
      validate: { isIn: [[KNOWLEDGE_DOMAIN_EXTERNAL]] }
    },
    ...extra,
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  };
}

// ---------------------------------------------------------------------------
// Provenance — every record traces back here.
// ---------------------------------------------------------------------------
export const IklSource = def(
  'IklSource',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: true },
    url: { type: DataTypes.TEXT, allowNull: true },
    document: { type: DataTypes.STRING, allowNull: true },
    document_type: {
      type: DataTypes.STRING(40),
      allowNull: false,
      validate: { isIn: [DOCUMENT_TYPES] }
    },
    version: { type: DataTypes.STRING, allowNull: true },
    retrieval_date: { type: DataTypes.DATEONLY, allowNull: true },
    confidence: { type: DataTypes.DECIMAL(5, 4), allowNull: true },
    publisher: { type: DataTypes.STRING, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  { tableName: 'ikl_sources' }
);

// Version history — updates snapshot the previous state here (never destructive).
export const IklRecordHistory = def(
  'IklRecordHistory',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    record_type: { type: DataTypes.STRING(40), allowNull: false },
    record_id: { type: DataTypes.INTEGER, allowNull: false },
    version: { type: DataTypes.INTEGER, allowNull: false },
    change_kind: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'update' },
    snapshot: { type: DataTypes.JSONB, allowNull: false },
    changed_by: { type: DataTypes.INTEGER, allowNull: true },
    changed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    tableName: 'ikl_record_history',
    indexes: [{ fields: ['record_type', 'record_id'] }]
  }
);

// ---------------------------------------------------------------------------
// Layer 1 — Companies (+ Brands)
// ---------------------------------------------------------------------------
export const IklCompany = def(
  'IklCompany',
  knowledgeColumns({
    name: { type: DataTypes.STRING, allowNull: false },
    business_units: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true, defaultValue: [] },
    product_families: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true, defaultValue: [] },
    geographic_presence: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true, defaultValue: [] },
    markets: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true, defaultValue: [] },
    technical_documentation: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] }
  }),
  { tableName: 'ikl_companies', indexes: [{ fields: ['name'] }] }
);

export const IklBrand = def(
  'IklBrand',
  knowledgeColumns({
    company_id: { type: DataTypes.INTEGER, allowNull: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true }
  }),
  { tableName: 'ikl_brands', indexes: [{ fields: ['company_id'] }, { fields: ['name'] }] }
);

// ---------------------------------------------------------------------------
// Layer 2 — Commercial Products
// ---------------------------------------------------------------------------
export const IklProduct = def(
  'IklProduct',
  knowledgeColumns({
    company_id: { type: DataTypes.INTEGER, allowNull: true },
    brand: { type: DataTypes.STRING, allowNull: true },
    product_name: { type: DataTypes.STRING, allowNull: false },
    product_code: { type: DataTypes.STRING, allowNull: true },
    product_family: { type: DataTypes.STRING, allowNull: true },
    product_version: { type: DataTypes.STRING, allowNull: true },
    classification: { type: DataTypes.STRING, allowNull: true },
    // { density, ph, solids, viscosity, particle_size, voc, dosage, storage, shelf_life }
    properties: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} }
  }),
  {
    tableName: 'ikl_products',
    indexes: [{ fields: ['company_id'] }, { fields: ['classification'] }, { fields: ['product_name'] }]
  }
);

// ---------------------------------------------------------------------------
// Layer 3 — Raw Materials
// ---------------------------------------------------------------------------
export const IklRawMaterial = def(
  'IklRawMaterial',
  knowledgeColumns({
    chemical_family: { type: DataTypes.STRING, allowNull: false },
    commercial_names: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true, defaultValue: [] },
    cas: { type: DataTypes.STRING, allowNull: true },
    synonyms: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true, defaultValue: [] },
    suppliers: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true, defaultValue: [] },
    functional_role: { type: DataTypes.STRING, allowNull: true }
  }),
  { tableName: 'ikl_raw_materials', indexes: [{ fields: ['cas'] }, { fields: ['chemical_family'] }] }
);

// ---------------------------------------------------------------------------
// Layer 4 — Functional Mechanisms (also the nodes of the Layer 10 graph)
// ---------------------------------------------------------------------------
export const IklMechanism = def(
  'IklMechanism',
  knowledgeColumns(
    {
      name: { type: DataTypes.STRING, allowNull: false },
      scientific_principle: { type: DataTypes.TEXT, allowNull: true },
      activation_conditions: { type: DataTypes.TEXT, allowNull: true },
      failure_mechanisms: { type: DataTypes.TEXT, allowNull: true },
      compatible_materials: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true, defaultValue: [] },
      incompatible_materials: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true, defaultValue: [] }
    },
    // Mechanism *names* may be seeded as taxonomy; the scientific claims still
    // require provenance before they are considered facts.
    { sourceRequired: false }
  ),
  { tableName: 'ikl_mechanisms', indexes: [{ fields: ['name'] }] }
);

// Layer 10 — edges between mechanism nodes (cause-effect / dependency graph).
export const IklMechanismEdge = def(
  'IklMechanismEdge',
  knowledgeColumns({
    from_mechanism_id: { type: DataTypes.INTEGER, allowNull: false },
    to_mechanism_id: { type: DataTypes.INTEGER, allowNull: false },
    relation: {
      type: DataTypes.STRING(30),
      allowNull: false,
      validate: { isIn: [MECHANISM_RELATIONS] }
    },
    scientific_reference: { type: DataTypes.TEXT, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true }
  }),
  {
    tableName: 'ikl_mechanism_edges',
    indexes: [{ fields: ['from_mechanism_id'] }, { fields: ['to_mechanism_id'] }]
  }
);

// ---------------------------------------------------------------------------
// Layer 5 — Applications
// ---------------------------------------------------------------------------
export const IklApplication = def(
  'IklApplication',
  knowledgeColumns(
    {
      name: { type: DataTypes.STRING, allowNull: false },
      domain: { type: DataTypes.STRING, allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true }
    },
    { sourceRequired: false }
  ),
  { tableName: 'ikl_applications', indexes: [{ fields: ['name'] }] }
);

// ---------------------------------------------------------------------------
// Layer 6 — Supply Chain
// ---------------------------------------------------------------------------
export const IklSupplyChain = def(
  'IklSupplyChain',
  knowledgeColumns({
    subject_type: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [SUBJECT_TYPES] } },
    subject_id: { type: DataTypes.INTEGER, allowNull: false },
    manufacturer: { type: DataTypes.STRING, allowNull: true },
    regional_distributors: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true, defaultValue: [] },
    packaging: { type: DataTypes.STRING, allowNull: true },
    shelf_life: { type: DataTypes.STRING, allowNull: true },
    lead_time: { type: DataTypes.STRING, allowNull: true },
    availability: { type: DataTypes.STRING, allowNull: true },
    import_restrictions: { type: DataTypes.TEXT, allowNull: true },
    export_restrictions: { type: DataTypes.TEXT, allowNull: true },
    storage_requirements: { type: DataTypes.TEXT, allowNull: true }
  }),
  { tableName: 'ikl_supply_chain', indexes: [{ fields: ['subject_type', 'subject_id'] }] }
);

// ---------------------------------------------------------------------------
// Layer 7 — Regulatory & Safety
// ---------------------------------------------------------------------------
export const IklRegulatory = def(
  'IklRegulatory',
  knowledgeColumns({
    subject_type: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [SUBJECT_TYPES] } },
    subject_id: { type: DataTypes.INTEGER, allowNull: false },
    // { reach, rohs, clp, ce, astm, en, iso, local }
    standards: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
    hazard_classification: { type: DataTypes.TEXT, allowNull: true },
    sds_url: { type: DataTypes.TEXT, allowNull: true },
    environmental_limitations: { type: DataTypes.TEXT, allowNull: true },
    worker_safety: { type: DataTypes.TEXT, allowNull: true }
  }),
  { tableName: 'ikl_regulatory', indexes: [{ fields: ['subject_type', 'subject_id'] }] }
);

// ---------------------------------------------------------------------------
// Layer 8 — Compatibility & Substitution (relationship graph)
// ---------------------------------------------------------------------------
export const IklRelationship = def(
  'IklRelationship',
  knowledgeColumns({
    from_type: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [SUBJECT_TYPES] } },
    from_id: { type: DataTypes.INTEGER, allowNull: false },
    to_type: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [SUBJECT_TYPES] } },
    to_id: { type: DataTypes.INTEGER, allowNull: false },
    relationship_type: {
      type: DataTypes.STRING(30),
      allowNull: false,
      validate: { isIn: [RELATIONSHIP_TYPES] }
    },
    notes: { type: DataTypes.TEXT, allowNull: true }
  }),
  {
    tableName: 'ikl_relationships',
    indexes: [{ fields: ['from_type', 'from_id'] }, { fields: ['to_type', 'to_id'] }, { fields: ['relationship_type'] }]
  }
);

// ---------------------------------------------------------------------------
// Layer 9 — Experimental Performance (measured vs manufacturer claim)
// ---------------------------------------------------------------------------
export const IklPerformance = def(
  'IklPerformance',
  knowledgeColumns({
    subject_type: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [SUBJECT_TYPES] } },
    subject_id: { type: DataTypes.INTEGER, allowNull: false },
    property: { type: DataTypes.STRING, allowNull: false },
    value: { type: DataTypes.STRING, allowNull: true },
    unit: { type: DataTypes.STRING, allowNull: true },
    test_method: { type: DataTypes.STRING, allowNull: true },
    // Keep measured performance separate from manufacturer claims.
    source_kind: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'manufacturer_claim',
      validate: { isIn: [PERFORMANCE_SOURCE_KINDS] }
    },
    failure_modes: { type: DataTypes.TEXT, allowNull: true },
    // { aging, freeze_thaw, uv_durability, salt_resistance, moisture_resistance, mechanical }
    conditions: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} }
  }),
  {
    tableName: 'ikl_performance',
    indexes: [{ fields: ['subject_type', 'subject_id'] }, { fields: ['source_kind'] }]
  }
);

// ---------------------------------------------------------------------------
// Layer 11 — Value Engineering (never estimate without a source)
// ---------------------------------------------------------------------------
export const IklValueEngineering = def(
  'IklValueEngineering',
  knowledgeColumns({
    subject_type: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [SUBJECT_TYPES] } },
    subject_id: { type: DataTypes.INTEGER, allowNull: false },
    currency: { type: DataTypes.STRING(8), allowNull: true },
    installation_cost: { type: DataTypes.STRING, allowNull: true },
    maintenance_cost: { type: DataTypes.STRING, allowNull: true },
    replacement_interval: { type: DataTypes.STRING, allowNull: true },
    expected_service_life: { type: DataTypes.STRING, allowNull: true },
    energy_savings: { type: DataTypes.STRING, allowNull: true },
    cost_per_year: { type: DataTypes.STRING, allowNull: true },
    life_cycle_cost: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
    roi: { type: DataTypes.STRING, allowNull: true },
    trade_offs: { type: DataTypes.TEXT, allowNull: true }
  }),
  { tableName: 'ikl_value_engineering', indexes: [{ fields: ['subject_type', 'subject_id'] }] }
);

// ---------------------------------------------------------------------------
// Layer 12 — Geo Context
// ---------------------------------------------------------------------------
export const IklGeoContext = def(
  'IklGeoContext',
  knowledgeColumns({
    region: { type: DataTypes.STRING, allowNull: true },
    country: { type: DataTypes.STRING, allowNull: true },
    climate: { type: DataTypes.STRING, allowNull: true },
    humidity: { type: DataTypes.STRING, allowNull: true },
    salt_exposure: { type: DataTypes.STRING, allowNull: true },
    solar_radiation: { type: DataTypes.STRING, allowNull: true },
    freeze_thaw_cycles: { type: DataTypes.STRING, allowNull: true },
    local_construction_practices: { type: DataTypes.TEXT, allowNull: true },
    country_regulations: { type: DataTypes.TEXT, allowNull: true },
    availability: { type: DataTypes.TEXT, allowNull: true },
    suitable_substrates: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true, defaultValue: [] }
  }),
  { tableName: 'ikl_geo_context', indexes: [{ fields: ['country'] }, { fields: ['region'] }] }
);

// ---------------------------------------------------------------------------
// Layer 13 — Failure Knowledge Library (negative knowledge base)
// ---------------------------------------------------------------------------
export const IklFailure = def(
  'IklFailure',
  knowledgeColumns({
    failure: { type: DataTypes.STRING, allowNull: false },
    root_cause: { type: DataTypes.TEXT, allowNull: true },
    observed_symptoms: { type: DataTypes.TEXT, allowNull: true },
    trigger: { type: DataTypes.TEXT, allowNull: true },
    repair_method: { type: DataTypes.TEXT, allowNull: true },
    preventive_actions: { type: DataTypes.TEXT, allowNull: true },
    related_materials: { type: DataTypes.ARRAY(DataTypes.INTEGER), allowNull: true, defaultValue: [] },
    related_mechanisms: { type: DataTypes.ARRAY(DataTypes.INTEGER), allowNull: true, defaultValue: [] }
  }),
  { tableName: 'ikl_failures', indexes: [{ fields: ['failure'] }] }
);

// ---------------------------------------------------------------------------
// Layer 14 — Innovation & Opportunity Discovery (always a hypothesis)
// ---------------------------------------------------------------------------
export const IklOpportunity = def(
  'IklOpportunity',
  knowledgeColumns({
    opportunity_type: {
      type: DataTypes.STRING(40),
      allowNull: false,
      validate: { isIn: [OPPORTUNITY_TYPES] }
    },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    rationale: { type: DataTypes.TEXT, allowNull: true },
    // Signals the hypothesis is based on (patent ids, papers, trends...).
    evidence: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'hypothesis',
      validate: { isIn: [CONNECTION_STATUS] }
    }
  }),
  { tableName: 'ikl_opportunities', indexes: [{ fields: ['opportunity_type'] }, { fields: ['status'] }] }
);

// ---------------------------------------------------------------------------
// Separation bridge — External ↔ Fresco. Hypothesis until validated.
// `fresco_ref` is an OPAQUE string; IKL never writes into internal tables.
// ---------------------------------------------------------------------------
export const IklConnection = def(
  'IklConnection',
  knowledgeColumns({
    external_type: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [SUBJECT_TYPES] } },
    external_id: { type: DataTypes.INTEGER, allowNull: false },
    // Opaque reference to Fresco internal knowledge (e.g. experiment_id, doc id).
    fresco_ref: { type: DataTypes.STRING, allowNull: false },
    fresco_ref_kind: { type: DataTypes.STRING(40), allowNull: true },
    relation: { type: DataTypes.STRING, allowNull: true },
    note: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'hypothesis',
      validate: { isIn: [CONNECTION_STATUS] }
    },
    validated_by: { type: DataTypes.INTEGER, allowNull: true },
    validated_at: { type: DataTypes.DATE, allowNull: true }
  }),
  {
    tableName: 'ikl_connections',
    indexes: [{ fields: ['external_type', 'external_id'] }, { fields: ['status'] }]
  }
);

// Associations (provenance include convenience; keeps sync ordering sane).
if (sequelize) {
  for (const M of [
    IklCompany, IklBrand, IklProduct, IklRawMaterial, IklMechanism, IklMechanismEdge,
    IklApplication, IklSupplyChain, IklRegulatory, IklRelationship, IklPerformance,
    IklValueEngineering, IklGeoContext, IklFailure, IklOpportunity, IklConnection
  ]) {
    M.belongsTo(IklSource, { foreignKey: 'source_id', as: 'source', constraints: false });
  }
}

/**
 * Registry of IKL knowledge layers. Drives the generic CRUD router.
 *   - model:          Sequelize model
 *   - recordType:     stable key for history rows
 *   - sourceRequired: whether a write must carry provenance (fact-stating layers)
 *   - writable:       fields a client may set (system/provenance fields excluded)
 */
export const IKL_LAYERS = {
  companies: { model: IklCompany, recordType: 'company', sourceRequired: true,
    writable: ['name', 'business_units', 'product_families', 'geographic_presence', 'markets', 'technical_documentation'] },
  brands: { model: IklBrand, recordType: 'brand', sourceRequired: true,
    writable: ['company_id', 'name', 'description'] },
  products: { model: IklProduct, recordType: 'product', sourceRequired: true,
    writable: ['company_id', 'brand', 'product_name', 'product_code', 'product_family', 'product_version', 'classification', 'properties'] },
  'raw-materials': { model: IklRawMaterial, recordType: 'raw_material', sourceRequired: true,
    writable: ['chemical_family', 'commercial_names', 'cas', 'synonyms', 'suppliers', 'functional_role'] },
  mechanisms: { model: IklMechanism, recordType: 'mechanism', sourceRequired: false,
    writable: ['name', 'scientific_principle', 'activation_conditions', 'failure_mechanisms', 'compatible_materials', 'incompatible_materials'] },
  'mechanism-edges': { model: IklMechanismEdge, recordType: 'mechanism_edge', sourceRequired: true,
    writable: ['from_mechanism_id', 'to_mechanism_id', 'relation', 'scientific_reference', 'notes'] },
  applications: { model: IklApplication, recordType: 'application', sourceRequired: false,
    writable: ['name', 'domain', 'description'] },
  'supply-chain': { model: IklSupplyChain, recordType: 'supply_chain', sourceRequired: true,
    writable: ['subject_type', 'subject_id', 'manufacturer', 'regional_distributors', 'packaging', 'shelf_life', 'lead_time', 'availability', 'import_restrictions', 'export_restrictions', 'storage_requirements'] },
  regulatory: { model: IklRegulatory, recordType: 'regulatory', sourceRequired: true,
    writable: ['subject_type', 'subject_id', 'standards', 'hazard_classification', 'sds_url', 'environmental_limitations', 'worker_safety'] },
  relationships: { model: IklRelationship, recordType: 'relationship', sourceRequired: true,
    writable: ['from_type', 'from_id', 'to_type', 'to_id', 'relationship_type', 'notes'] },
  performance: { model: IklPerformance, recordType: 'performance', sourceRequired: true,
    writable: ['subject_type', 'subject_id', 'property', 'value', 'unit', 'test_method', 'source_kind', 'failure_modes', 'conditions'] },
  'value-engineering': { model: IklValueEngineering, recordType: 'value_engineering', sourceRequired: true,
    writable: ['subject_type', 'subject_id', 'currency', 'installation_cost', 'maintenance_cost', 'replacement_interval', 'expected_service_life', 'energy_savings', 'cost_per_year', 'life_cycle_cost', 'roi', 'trade_offs'] },
  'geo-context': { model: IklGeoContext, recordType: 'geo_context', sourceRequired: true,
    writable: ['region', 'country', 'climate', 'humidity', 'salt_exposure', 'solar_radiation', 'freeze_thaw_cycles', 'local_construction_practices', 'country_regulations', 'availability', 'suitable_substrates'] },
  failures: { model: IklFailure, recordType: 'failure', sourceRequired: true,
    writable: ['failure', 'root_cause', 'observed_symptoms', 'trigger', 'repair_method', 'preventive_actions', 'related_materials', 'related_mechanisms'] },
  opportunities: { model: IklOpportunity, recordType: 'opportunity', sourceRequired: true,
    writable: ['opportunity_type', 'title', 'description', 'rationale', 'evidence'] }
};

export { sequelize };
