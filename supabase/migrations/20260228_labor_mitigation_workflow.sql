-- ============================================================
-- LABOR MITIGATION WORKFLOW
-- ============================================================

CREATE TABLE IF NOT EXISTS labor_mitigation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES labor_risk_assessments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  due_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_labor_mitigation_assessment ON labor_mitigation_actions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_labor_mitigation_user ON labor_mitigation_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_labor_mitigation_status ON labor_mitigation_actions(status);

ALTER TABLE labor_mitigation_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS labor_mitigation_user_policy ON labor_mitigation_actions;
CREATE POLICY labor_mitigation_user_policy ON labor_mitigation_actions
  FOR ALL
  USING (user_id = auth.uid());

COMMENT ON TABLE labor_mitigation_actions IS 'Acciones de mitigacion y seguimiento ligadas a evaluaciones de riesgo laboral';
