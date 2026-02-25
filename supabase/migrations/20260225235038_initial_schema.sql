-- ============================================================
-- ANCLORA ADVISOR AI - DATABASE SCHEMA
-- PostgreSQL + pgvector
-- ============================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- AUTHENTICATION & USERS
-- ============================================================

-- CORRECCIÓN: El id debe referenciar a auth.users para que las políticas RLS con auth.uid() funcionen.
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'personal', -- 'personal', 'admin', 'client'
  organization_id UUID, -- NULL for personal use
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organization ON users(organization_id);

-- ============================================================
-- CONVERSATIONS & MESSAGES
-- ============================================================

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conversations_user ON conversations(user_id);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  context_chunks UUID[] DEFAULT '{}', -- Referencia a los chunks de RAG utilizados
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);

-- ============================================================
-- FISCAL & ADMINISTRATIVE
-- ============================================================

CREATE TABLE fiscal_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_type VARCHAR(100) NOT NULL, -- 'iva', 'irpf', 'cuota_cero', 'roaiib'
  description TEXT,
  due_date DATE NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'resolved', 'ignored'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fiscal_alerts_user ON fiscal_alerts(user_id);
CREATE INDEX idx_fiscal_alerts_date ON fiscal_alerts(due_date);

-- ============================================================
-- LABOR RISK & COMPLIANCE
-- ============================================================

CREATE TABLE labor_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario_description TEXT NOT NULL,
  risk_score DECIMAL(3,2) NOT NULL, -- 0.00 to 1.00
  risk_level VARCHAR(50), -- 'low', 'medium', 'high', 'critical'
  recommendations TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_labor_risk_user ON labor_risk_assessments(user_id);

-- ============================================================
-- INVOICING
-- ============================================================

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_name VARCHAR(255) NOT NULL,
  client_nif VARCHAR(50) NOT NULL,
  amount_base DECIMAL(10,2) NOT NULL,
  iva_rate DECIMAL(4,2) DEFAULT 21.00,
  irpf_retention DECIMAL(4,2) DEFAULT 15.00, -- 7.00 or 15.00
  total_amount DECIMAL(10,2) NOT NULL,
  issue_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'issued', 'paid'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoices_user ON invoices(user_id);

-- ============================================================
-- RAG (RETRIEVAL-AUGMENTED GENERATION)
-- ============================================================

CREATE TABLE rag_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  category VARCHAR(100), -- 'fiscal', 'laboral', 'mercado'
  source_url VARCHAR(1000),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rag_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(384), -- Usando sentence-transformers/multilingual-MiniLM-L12-v2
  token_count INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índice para búsqueda vectorial de similitud (HNSW o IVFFlat)
CREATE INDEX idx_rag_chunks_embedding ON rag_chunks USING hnsw (embedding vector_cosine_ops);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data
CREATE POLICY user_data_policy ON conversations
  FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY message_data_policy ON messages
  FOR ALL
  USING (conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid()));

CREATE POLICY alert_data_policy ON fiscal_alerts
  FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY risk_data_policy ON labor_risk_assessments
  FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY invoice_data_policy ON invoices
  FOR ALL
  USING (user_id = auth.uid());

-- RAG documents and chunks are public for reading by authenticated users
CREATE POLICY rag_docs_read_policy ON rag_documents
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY rag_chunks_read_policy ON rag_chunks
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================
-- INITIAL COMMENTS
-- ============================================================

COMMENT ON TABLE rag_chunks IS 'Chunks vectorizados de NotebookLM, indexados con pgvector para búsqueda semántica';
COMMENT ON COLUMN rag_chunks.embedding IS 'Vector embedding de 384 dimensiones (sentence-transformers/multilingual-MiniLM-L12-v2)';
COMMENT ON TABLE fiscal_alerts IS 'Alertas fiscales de obligaciones (IVA, RETA, ROAIIB, etc.)';
COMMENT ON TABLE labor_risk_assessments IS 'Evaluaciones de riesgo laboral asociadas a escenarios de pluriactividad';
