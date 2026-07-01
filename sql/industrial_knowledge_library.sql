-- ============================================================================
-- MATRIYA Industrial Knowledge Library (IKL)
-- External scientific reference layer — fully separated from Fresco internal
-- knowledge. Run in the Supabase SQL Editor (idempotent).
--
-- Principles enforced here:
--   * Every table is namespaced `ikl_` (namespace separation from Fresco).
--   * Provenance: knowledge rows carry `source_id` → ikl_sources.
--   * Domain guard: `knowledge_domain` is CHECK-constrained to 'external'.
--   * Separation: ikl_connections links to Fresco only via an opaque
--     `fresco_ref` string and defaults to status 'hypothesis'.
--   * Version history: ikl_record_history stores snapshots of prior versions.
-- The Sequelize layer (iklModels.js) creates the same tables via sync(); this
-- file is the production source-of-truth and documents the intended shape.
-- ============================================================================

-- Provenance -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ikl_sources (
    id SERIAL PRIMARY KEY,
    title VARCHAR,
    url TEXT,
    document VARCHAR,
    document_type VARCHAR(40) NOT NULL,
    version VARCHAR,
    retrieval_date DATE,
    confidence NUMERIC(5,4),
    publisher VARCHAR,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ikl_record_history (
    id SERIAL PRIMARY KEY,
    record_type VARCHAR(40) NOT NULL,
    record_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    change_kind VARCHAR(20) NOT NULL DEFAULT 'update',
    snapshot JSONB NOT NULL,
    changed_by INTEGER,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ikl_record_history_record_idx ON ikl_record_history(record_type, record_id);

-- Shared knowledge columns (repeated per table): source_id, confidence,
-- version, is_hypothesis, knowledge_domain CHECK ('external'), created/updated.

-- Layer 1 — Companies & Brands ----------------------------------------------
CREATE TABLE IF NOT EXISTS ikl_companies (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES ikl_sources(id),
    confidence NUMERIC(5,4),
    version INTEGER NOT NULL DEFAULT 1,
    is_hypothesis BOOLEAN NOT NULL DEFAULT FALSE,
    knowledge_domain VARCHAR(20) NOT NULL DEFAULT 'external' CHECK (knowledge_domain = 'external'),
    name VARCHAR NOT NULL,
    business_units TEXT[] DEFAULT '{}',
    product_families TEXT[] DEFAULT '{}',
    geographic_presence TEXT[] DEFAULT '{}',
    markets TEXT[] DEFAULT '{}',
    technical_documentation JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ikl_companies_name_idx ON ikl_companies(name);

CREATE TABLE IF NOT EXISTS ikl_brands (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES ikl_sources(id),
    confidence NUMERIC(5,4),
    version INTEGER NOT NULL DEFAULT 1,
    is_hypothesis BOOLEAN NOT NULL DEFAULT FALSE,
    knowledge_domain VARCHAR(20) NOT NULL DEFAULT 'external' CHECK (knowledge_domain = 'external'),
    company_id INTEGER,
    name VARCHAR NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ikl_brands_company_idx ON ikl_brands(company_id);

-- Layer 2 — Commercial Products ---------------------------------------------
CREATE TABLE IF NOT EXISTS ikl_products (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES ikl_sources(id),
    confidence NUMERIC(5,4),
    version INTEGER NOT NULL DEFAULT 1,
    is_hypothesis BOOLEAN NOT NULL DEFAULT FALSE,
    knowledge_domain VARCHAR(20) NOT NULL DEFAULT 'external' CHECK (knowledge_domain = 'external'),
    company_id INTEGER,
    brand VARCHAR,
    product_name VARCHAR NOT NULL,
    product_code VARCHAR,
    product_family VARCHAR,
    product_version VARCHAR,
    classification VARCHAR,
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ikl_products_company_idx ON ikl_products(company_id);
CREATE INDEX IF NOT EXISTS ikl_products_classification_idx ON ikl_products(classification);

-- Layer 3 — Raw Materials ----------------------------------------------------
CREATE TABLE IF NOT EXISTS ikl_raw_materials (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES ikl_sources(id),
    confidence NUMERIC(5,4),
    version INTEGER NOT NULL DEFAULT 1,
    is_hypothesis BOOLEAN NOT NULL DEFAULT FALSE,
    knowledge_domain VARCHAR(20) NOT NULL DEFAULT 'external' CHECK (knowledge_domain = 'external'),
    chemical_family VARCHAR NOT NULL,
    commercial_names TEXT[] DEFAULT '{}',
    cas VARCHAR,
    synonyms TEXT[] DEFAULT '{}',
    suppliers TEXT[] DEFAULT '{}',
    functional_role VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ikl_raw_materials_cas_idx ON ikl_raw_materials(cas);

-- Layer 4 — Functional Mechanisms (nodes) -----------------------------------
CREATE TABLE IF NOT EXISTS ikl_mechanisms (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES ikl_sources(id),
    confidence NUMERIC(5,4),
    version INTEGER NOT NULL DEFAULT 1,
    is_hypothesis BOOLEAN NOT NULL DEFAULT FALSE,
    knowledge_domain VARCHAR(20) NOT NULL DEFAULT 'external' CHECK (knowledge_domain = 'external'),
    name VARCHAR NOT NULL,
    scientific_principle TEXT,
    activation_conditions TEXT,
    failure_mechanisms TEXT,
    compatible_materials TEXT[] DEFAULT '{}',
    incompatible_materials TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ikl_mechanisms_name_idx ON ikl_mechanisms(name);

-- Layer 10 — Mechanism Knowledge Graph (edges) ------------------------------
CREATE TABLE IF NOT EXISTS ikl_mechanism_edges (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES ikl_sources(id),
    confidence NUMERIC(5,4),
    version INTEGER NOT NULL DEFAULT 1,
    is_hypothesis BOOLEAN NOT NULL DEFAULT FALSE,
    knowledge_domain VARCHAR(20) NOT NULL DEFAULT 'external' CHECK (knowledge_domain = 'external'),
    from_mechanism_id INTEGER NOT NULL,
    to_mechanism_id INTEGER NOT NULL,
    relation VARCHAR(30) NOT NULL,
    scientific_reference TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ikl_mechanism_edges_from_idx ON ikl_mechanism_edges(from_mechanism_id);
CREATE INDEX IF NOT EXISTS ikl_mechanism_edges_to_idx ON ikl_mechanism_edges(to_mechanism_id);

-- Layer 5 — Applications -----------------------------------------------------
CREATE TABLE IF NOT EXISTS ikl_applications (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES ikl_sources(id),
    confidence NUMERIC(5,4),
    version INTEGER NOT NULL DEFAULT 1,
    is_hypothesis BOOLEAN NOT NULL DEFAULT FALSE,
    knowledge_domain VARCHAR(20) NOT NULL DEFAULT 'external' CHECK (knowledge_domain = 'external'),
    name VARCHAR NOT NULL,
    domain VARCHAR,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ikl_applications_name_idx ON ikl_applications(name);

-- Layer 6 — Supply Chain -----------------------------------------------------
CREATE TABLE IF NOT EXISTS ikl_supply_chain (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES ikl_sources(id),
    confidence NUMERIC(5,4),
    version INTEGER NOT NULL DEFAULT 1,
    is_hypothesis BOOLEAN NOT NULL DEFAULT FALSE,
    knowledge_domain VARCHAR(20) NOT NULL DEFAULT 'external' CHECK (knowledge_domain = 'external'),
    subject_type VARCHAR(20) NOT NULL,
    subject_id INTEGER NOT NULL,
    manufacturer VARCHAR,
    regional_distributors TEXT[] DEFAULT '{}',
    packaging VARCHAR,
    shelf_life VARCHAR,
    lead_time VARCHAR,
    availability VARCHAR,
    import_restrictions TEXT,
    export_restrictions TEXT,
    storage_requirements TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ikl_supply_chain_subject_idx ON ikl_supply_chain(subject_type, subject_id);

-- Layer 7 — Regulatory & Safety ---------------------------------------------
CREATE TABLE IF NOT EXISTS ikl_regulatory (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES ikl_sources(id),
    confidence NUMERIC(5,4),
    version INTEGER NOT NULL DEFAULT 1,
    is_hypothesis BOOLEAN NOT NULL DEFAULT FALSE,
    knowledge_domain VARCHAR(20) NOT NULL DEFAULT 'external' CHECK (knowledge_domain = 'external'),
    subject_type VARCHAR(20) NOT NULL,
    subject_id INTEGER NOT NULL,
    standards JSONB DEFAULT '{}',
    hazard_classification TEXT,
    sds_url TEXT,
    environmental_limitations TEXT,
    worker_safety TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ikl_regulatory_subject_idx ON ikl_regulatory(subject_type, subject_id);

-- Layer 8 — Compatibility & Substitution ------------------------------------
CREATE TABLE IF NOT EXISTS ikl_relationships (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES ikl_sources(id),
    confidence NUMERIC(5,4),
    version INTEGER NOT NULL DEFAULT 1,
    is_hypothesis BOOLEAN NOT NULL DEFAULT FALSE,
    knowledge_domain VARCHAR(20) NOT NULL DEFAULT 'external' CHECK (knowledge_domain = 'external'),
    from_type VARCHAR(20) NOT NULL,
    from_id INTEGER NOT NULL,
    to_type VARCHAR(20) NOT NULL,
    to_id INTEGER NOT NULL,
    relationship_type VARCHAR(30) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ikl_relationships_from_idx ON ikl_relationships(from_type, from_id);
CREATE INDEX IF NOT EXISTS ikl_relationships_to_idx ON ikl_relationships(to_type, to_id);

-- Layer 9 — Experimental Performance ----------------------------------------
CREATE TABLE IF NOT EXISTS ikl_performance (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES ikl_sources(id),
    confidence NUMERIC(5,4),
    version INTEGER NOT NULL DEFAULT 1,
    is_hypothesis BOOLEAN NOT NULL DEFAULT FALSE,
    knowledge_domain VARCHAR(20) NOT NULL DEFAULT 'external' CHECK (knowledge_domain = 'external'),
    subject_type VARCHAR(20) NOT NULL,
    subject_id INTEGER NOT NULL,
    property VARCHAR NOT NULL,
    value VARCHAR,
    unit VARCHAR,
    test_method VARCHAR,
    source_kind VARCHAR(20) NOT NULL DEFAULT 'manufacturer_claim',
    failure_modes TEXT,
    conditions JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ikl_performance_subject_idx ON ikl_performance(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS ikl_performance_kind_idx ON ikl_performance(source_kind);

-- Layer 11 — Value Engineering ----------------------------------------------
CREATE TABLE IF NOT EXISTS ikl_value_engineering (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES ikl_sources(id),
    confidence NUMERIC(5,4),
    version INTEGER NOT NULL DEFAULT 1,
    is_hypothesis BOOLEAN NOT NULL DEFAULT FALSE,
    knowledge_domain VARCHAR(20) NOT NULL DEFAULT 'external' CHECK (knowledge_domain = 'external'),
    subject_type VARCHAR(20) NOT NULL,
    subject_id INTEGER NOT NULL,
    currency VARCHAR(8),
    installation_cost VARCHAR,
    maintenance_cost VARCHAR,
    replacement_interval VARCHAR,
    expected_service_life VARCHAR,
    energy_savings VARCHAR,
    cost_per_year VARCHAR,
    life_cycle_cost JSONB DEFAULT '{}',
    roi VARCHAR,
    trade_offs TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ikl_value_engineering_subject_idx ON ikl_value_engineering(subject_type, subject_id);

-- Layer 12 — Geo Context -----------------------------------------------------
CREATE TABLE IF NOT EXISTS ikl_geo_context (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES ikl_sources(id),
    confidence NUMERIC(5,4),
    version INTEGER NOT NULL DEFAULT 1,
    is_hypothesis BOOLEAN NOT NULL DEFAULT FALSE,
    knowledge_domain VARCHAR(20) NOT NULL DEFAULT 'external' CHECK (knowledge_domain = 'external'),
    region VARCHAR,
    country VARCHAR,
    climate VARCHAR,
    humidity VARCHAR,
    salt_exposure VARCHAR,
    solar_radiation VARCHAR,
    freeze_thaw_cycles VARCHAR,
    local_construction_practices TEXT,
    country_regulations TEXT,
    availability TEXT,
    suitable_substrates TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ikl_geo_context_country_idx ON ikl_geo_context(country);

-- Layer 13 — Failure Knowledge Library --------------------------------------
CREATE TABLE IF NOT EXISTS ikl_failures (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES ikl_sources(id),
    confidence NUMERIC(5,4),
    version INTEGER NOT NULL DEFAULT 1,
    is_hypothesis BOOLEAN NOT NULL DEFAULT FALSE,
    knowledge_domain VARCHAR(20) NOT NULL DEFAULT 'external' CHECK (knowledge_domain = 'external'),
    failure VARCHAR NOT NULL,
    root_cause TEXT,
    observed_symptoms TEXT,
    trigger TEXT,
    repair_method TEXT,
    preventive_actions TEXT,
    related_materials INTEGER[] DEFAULT '{}',
    related_mechanisms INTEGER[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ikl_failures_failure_idx ON ikl_failures(failure);

-- Layer 14 — Innovation & Opportunity Discovery (always hypothesis) ---------
CREATE TABLE IF NOT EXISTS ikl_opportunities (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES ikl_sources(id),
    confidence NUMERIC(5,4),
    version INTEGER NOT NULL DEFAULT 1,
    is_hypothesis BOOLEAN NOT NULL DEFAULT FALSE,
    knowledge_domain VARCHAR(20) NOT NULL DEFAULT 'external' CHECK (knowledge_domain = 'external'),
    opportunity_type VARCHAR(40) NOT NULL,
    title VARCHAR NOT NULL,
    description TEXT,
    rationale TEXT,
    evidence JSONB DEFAULT '[]',
    status VARCHAR(20) NOT NULL DEFAULT 'hypothesis',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ikl_opportunities_type_idx ON ikl_opportunities(opportunity_type);
CREATE INDEX IF NOT EXISTS ikl_opportunities_status_idx ON ikl_opportunities(status);

-- Separation bridge — External ↔ Fresco (hypothesis until validated) ---------
-- fresco_ref is an OPAQUE string. IKL never has a foreign key into Fresco
-- internal tables, so external knowledge can never overwrite internal knowledge.
CREATE TABLE IF NOT EXISTS ikl_connections (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES ikl_sources(id),
    confidence NUMERIC(5,4),
    version INTEGER NOT NULL DEFAULT 1,
    is_hypothesis BOOLEAN NOT NULL DEFAULT TRUE,
    knowledge_domain VARCHAR(20) NOT NULL DEFAULT 'external' CHECK (knowledge_domain = 'external'),
    external_type VARCHAR(20) NOT NULL,
    external_id INTEGER NOT NULL,
    fresco_ref VARCHAR NOT NULL,
    fresco_ref_kind VARCHAR(40),
    relation VARCHAR,
    note TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'hypothesis',
    validated_by INTEGER,
    validated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ikl_connections_external_idx ON ikl_connections(external_type, external_id);
CREATE INDEX IF NOT EXISTS ikl_connections_status_idx ON ikl_connections(status);

-- Semantic search index — SEPARATE vector collection from Fresco's
-- rag_documents (kept apart so external vectors never mix into the internal RAG).
-- Auto-created at runtime by the IKL vector store; included here as the
-- production source-of-truth. Dimension 384 matches all-MiniLM-L6-v2.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS ikl_embeddings (
    id TEXT PRIMARY KEY,          -- "<record_type>:<record_id>"
    embedding vector(384),
    document TEXT NOT NULL,
    metadata JSONB,               -- { layer, record_type, record_id }
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ikl_embeddings_embedding_idx
    ON ikl_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS ikl_embeddings_metadata_idx ON ikl_embeddings USING GIN (metadata);

-- Done.
