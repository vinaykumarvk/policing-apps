import { query } from "../db";

type DbRow = Record<string, unknown>;

// Model registry CRUD
export async function registerModel(data: {
  modelName: string;
  modelType: string;
  version: string;
  description?: string;
  config?: Record<string, unknown>;
  createdBy?: string;
}): Promise<DbRow> {
  const result = await query(
    `INSERT INTO model_registry (model_name, model_type, version, description, config, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [data.modelName, data.modelType, data.version, data.description || null,
     JSON.stringify(data.config || {}), data.createdBy || null]
  );
  return result.rows[0];
}

export async function listModels(filters?: { modelType?: string; status?: string }): Promise<DbRow[]> {
  let sql = `SELECT * FROM model_registry WHERE 1=1`;
  const params: unknown[] = [];
  let idx = 1;

  if (filters?.modelType) {
    sql += ` AND model_type = $${idx++}`;
    params.push(filters.modelType);
  }
  if (filters?.status) {
    sql += ` AND status = $${idx++}`;
    params.push(filters.status);
  }

  sql += ` ORDER BY model_name, version DESC`;
  const result = await query(sql, params);
  return result.rows;
}

export async function getModel(modelId: string): Promise<DbRow | null> {
  const result = await query(`SELECT * FROM model_registry WHERE model_id = $1`, [modelId]);
  return result.rows[0] || null;
}

export async function getActiveModel(modelName: string): Promise<DbRow | null> {
  const result = await query(
    `SELECT * FROM model_registry WHERE model_name = $1 AND status = 'ACTIVE' ORDER BY activated_at DESC LIMIT 1`,
    [modelName]
  );
  return result.rows[0] || null;
}

export async function updateModelStatus(modelId: string, status: string): Promise<DbRow> {
  let extraSql = "";
  if (status === "ACTIVE") {
    // Deprecate any currently active version of the same model
    const model = await getModel(modelId);
    if (model) {
      await query(
        `UPDATE model_registry SET status = 'DEPRECATED', updated_at = now() WHERE model_name = $1 AND status = 'ACTIVE' AND model_id != $2`,
        [model.model_name, modelId]
      );
    }
    extraSql = ", activated_at = now()";
  } else if (status === "RETIRED") {
    extraSql = ", retired_at = now()";
  }

  const result = await query(
    `UPDATE model_registry SET status = $2, updated_at = now()${extraSql} WHERE model_id = $1 RETURNING *`,
    [modelId, status]
  );
  return result.rows[0];
}

export async function updateModelMetrics(modelId: string, metrics: Record<string, unknown>): Promise<DbRow> {
  const result = await query(
    `UPDATE model_registry SET performance_metrics = $2, updated_at = now() WHERE model_id = $1 RETURNING *`,
    [modelId, JSON.stringify(metrics)]
  );
  return result.rows[0];
}

// Evaluations
export async function addEvaluation(data: {
  modelId: string;
  evaluationType?: string;
  datasetName?: string;
  datasetSize?: number;
  metrics: Record<string, unknown>;
  notes?: string;
  evaluatedBy?: string;
}): Promise<DbRow> {
  const result = await query(
    `INSERT INTO model_evaluation (model_id, evaluation_type, dataset_name, dataset_size, metrics, notes, evaluated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [data.modelId, data.evaluationType || "MANUAL", data.datasetName || null,
     data.datasetSize || null, JSON.stringify(data.metrics), data.notes || null, data.evaluatedBy || null]
  );
  return result.rows[0];
}

export async function getEvaluations(modelId: string): Promise<DbRow[]> {
  const result = await query(
    `SELECT * FROM model_evaluation WHERE model_id = $1 ORDER BY created_at DESC`,
    [modelId]
  );
  return result.rows;
}

// Prediction logging
export async function logPrediction(data: {
  modelId: string;
  inputHash?: string;
  prediction: Record<string, unknown>;
  actualLabel?: string;
  isCorrect?: boolean;
  latencyMs?: number;
}): Promise<DbRow> {
  const result = await query(
    `INSERT INTO model_prediction_log (model_id, input_hash, prediction, actual_label, is_correct, latency_ms)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [data.modelId, data.inputHash || null, JSON.stringify(data.prediction),
     data.actualLabel || null, data.isCorrect ?? null, data.latencyMs || null]
  );
  return result.rows[0];
}

export async function getModelPerformanceStats(modelId: string): Promise<DbRow> {
  const result = await query(
    `SELECT
       COUNT(*) as total_predictions,
       SUM(CASE WHEN is_correct = true THEN 1 ELSE 0 END) as correct,
       SUM(CASE WHEN is_correct = false THEN 1 ELSE 0 END) as incorrect,
       SUM(CASE WHEN is_correct IS NULL THEN 1 ELSE 0 END) as unverified,
       ROUND(AVG(latency_ms)::numeric, 2) as avg_latency_ms,
       ROUND((SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::numeric / NULLIF(SUM(CASE WHEN is_correct IS NOT NULL THEN 1 ELSE 0 END), 0) * 100), 2) as accuracy_pct
     FROM model_prediction_log WHERE model_id = $1`,
    [modelId]
  );
  return result.rows[0];
}

// Version history
export async function getVersionHistory(modelName: string): Promise<DbRow[]> {
  const result = await query(
    `SELECT mr.*,
            (SELECT COUNT(*) FROM model_prediction_log mpl WHERE mpl.model_id = mr.model_id) as prediction_count,
            (SELECT COUNT(*) FROM model_evaluation me WHERE me.model_id = mr.model_id) as evaluation_count
     FROM model_registry mr WHERE mr.model_name = $1 ORDER BY mr.created_at DESC`,
    [modelName]
  );
  return result.rows;
}
