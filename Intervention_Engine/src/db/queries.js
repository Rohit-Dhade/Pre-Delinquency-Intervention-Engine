// ─────────────────────────────────────────────────────
// src/db/queries.js — All SQL queries (parameterised)
// ─────────────────────────────────────────────────────
import pool from './pool.js';

// ── Read from shared customers table (owned by FastAPI) ──

export async function getCustomerById(customerId) {
  const { rows } = await pool.query(
    `SELECT name, email, segment, geography
     FROM customers
     WHERE customer_id = $1`,
    [customerId]
  );
  return rows[0] || null;
}

// ── Outcome queries ──

export async function getLastInterventionResponse(customerId) {
  const { rows } = await pool.query(
    `SELECT offer_accepted
     FROM outcome_log
     WHERE customer_id = $1
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [customerId]
  );
  if (!rows[0]) return 'no_history';
  if (rows[0].offer_accepted === true) return 'accepted';
  return 'ignored';
}

// ── Intervention log writes ──

export async function insertIntervention(data) {
  const { rows } = await pool.query(
    `INSERT INTO intervention_log
       (customer_id, risk_tier, delinquency_prob, offer_type,
        channel, email_type, message_sent, email_subject,
        model_version, dry_run)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      data.customer_id,
      data.risk_tier,
      data.delinquency_prob,
      data.offer_type,
      data.channel,
      data.email_type,
      data.message_sent,
      data.email_subject,
      data.model_version,
      data.dry_run,
    ]
  );
  return rows[0].id;
}

export async function updateEmailDelivered(interventionId) {
  await pool.query(
    `UPDATE intervention_log
     SET email_delivered = true
     WHERE id = $1`,
    [interventionId]
  );
}

// ── Outcome log writes ──

export async function insertOutcome(data) {
  await pool.query(
    `INSERT INTO outcome_log
       (intervention_id, customer_id, offer_accepted,
        days_to_resolve, did_default_anyway)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      data.intervention_id,
      data.customer_id,
      data.offer_accepted,
      data.days_to_resolve,
      data.did_default_anyway,
    ]
  );
}

// ── History ──

export async function getInterventionHistory(customerId) {
  const { rows } = await pool.query(
    `SELECT i.*,
            o.offer_accepted,
            o.days_to_resolve,
            o.did_default_anyway
     FROM intervention_log i
     LEFT JOIN outcome_log o
       ON i.id = o.intervention_id
     WHERE i.customer_id = $1
     ORDER BY i.triggered_at DESC
     LIMIT 6`,
    [customerId]
  );
  return rows;
}

// ── Stats (aggregation queries) ──

export async function getStats() {
  // Acceptance rate by tier
  const acceptanceByTier = await pool.query(`
    SELECT i.risk_tier AS tier,
           COUNT(o.id) FILTER (WHERE o.offer_accepted = true) AS accepted,
           COUNT(o.id) AS total
    FROM intervention_log i
    LEFT JOIN outcome_log o ON i.id = o.intervention_id
    WHERE i.triggered_at >= NOW() - INTERVAL '7 days'
      AND i.dry_run = false
    GROUP BY i.risk_tier
  `);

  // Recovery rate by offer type
  const recoveryByOffer = await pool.query(`
    SELECT i.offer_type,
           COUNT(o.id) FILTER (WHERE o.did_default_anyway = false) AS recovered,
           COUNT(o.id) AS total
    FROM intervention_log i
    LEFT JOIN outcome_log o ON i.id = o.intervention_id
    WHERE i.triggered_at >= NOW() - INTERVAL '7 days'
      AND i.dry_run = false
      AND o.id IS NOT NULL
    GROUP BY i.offer_type
  `);

  // Email delivery rate
  const emailStats = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE email_delivered = true) AS delivered,
      COUNT(*) AS total
    FROM intervention_log
    WHERE triggered_at >= NOW() - INTERVAL '7 days'
      AND dry_run = false
  `);

  // False positive rate (interventions where customer did NOT default)
  const fpStats = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE o.did_default_anyway = false AND o.offer_accepted = false) AS false_positives,
      COUNT(*) AS total
    FROM intervention_log i
    LEFT JOIN outcome_log o ON i.id = o.intervention_id
    WHERE i.triggered_at >= NOW() - INTERVAL '7 days'
      AND i.dry_run = false
      AND o.id IS NOT NULL
  `);

  // Tier distribution this week
  const tierDist = await pool.query(`
    SELECT risk_tier, COUNT(*) AS count
    FROM intervention_log
    WHERE triggered_at >= NOW() - INTERVAL '7 days'
      AND dry_run = false
    GROUP BY risk_tier
  `);

  // Total interventions this week
  const totalWeek = await pool.query(`
    SELECT COUNT(*) AS total
    FROM intervention_log
    WHERE triggered_at >= NOW() - INTERVAL '7 days'
      AND dry_run = false
  `);

  // ── Format results ──

  const byTier = {};
  for (const row of acceptanceByTier.rows) {
    byTier[row.tier] = row.total > 0
      ? parseFloat((row.accepted / row.total).toFixed(4))
      : 0;
  }

  const byOfferAcceptance = {};
  for (const row of acceptanceByTier.rows) {
    // group by offer type from recovery query for acceptance
  }

  const byOfferRecovery = {};
  for (const row of recoveryByOffer.rows) {
    byOfferRecovery[row.offer_type] = row.total > 0
      ? parseFloat((row.recovered / row.total).toFixed(4))
      : 0;
  }

  const emailRow = emailStats.rows[0] || { delivered: 0, total: 0 };
  const emailDeliveryRate = emailRow.total > 0
    ? parseFloat((emailRow.delivered / emailRow.total).toFixed(4))
    : 0;

  const fpRow = fpStats.rows[0] || { false_positives: 0, total: 0 };
  const falsePositiveRate = fpRow.total > 0
    ? parseFloat((fpRow.false_positives / fpRow.total).toFixed(4))
    : 0;

  const tierDistribution = { critical: 0, moderate: 0, watch: 0, stable: 0 };
  for (const row of tierDist.rows) {
    tierDistribution[row.risk_tier] = parseInt(row.count, 10);
  }

  // Acceptance by offer type
  const acceptanceByOffer = await pool.query(`
    SELECT i.offer_type,
           COUNT(o.id) FILTER (WHERE o.offer_accepted = true) AS accepted,
           COUNT(o.id) AS total
    FROM intervention_log i
    LEFT JOIN outcome_log o ON i.id = o.intervention_id
    WHERE i.triggered_at >= NOW() - INTERVAL '7 days'
      AND i.dry_run = false
      AND o.id IS NOT NULL
    GROUP BY i.offer_type
  `);

  const byOfferType = {};
  for (const row of acceptanceByOffer.rows) {
    byOfferType[row.offer_type] = row.total > 0
      ? parseFloat((row.accepted / row.total).toFixed(4))
      : 0;
  }

  return {
    offer_acceptance_rate: {
      by_tier: byTier,
      by_offer_type: byOfferType,
    },
    recovery_rate: {
      by_offer_type: byOfferRecovery,
    },
    email_delivery_rate: emailDeliveryRate,
    false_positive_rate: falsePositiveRate,
    total_interventions_this_week: parseInt(totalWeek.rows[0]?.total || 0, 10),
    tier_distribution: tierDistribution,
  };
}

// ── Weekly acceptance/recovery rates (for outcome response) ──

export async function getWeeklyRates() {
  const acceptance = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE offer_accepted = true) AS accepted,
      COUNT(*) AS total
    FROM outcome_log
    WHERE recorded_at >= NOW() - INTERVAL '7 days'
  `);

  const recovery = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE did_default_anyway = false) AS recovered,
      COUNT(*) AS total
    FROM outcome_log
    WHERE recorded_at >= NOW() - INTERVAL '7 days'
  `);

  const accRow = acceptance.rows[0] || { accepted: 0, total: 0 };
  const recRow = recovery.rows[0] || { recovered: 0, total: 0 };

  return {
    acceptance_rate_this_week: accRow.total > 0
      ? parseFloat((accRow.accepted / accRow.total).toFixed(4))
      : 0,
    recovery_rate_this_week: recRow.total > 0
      ? parseFloat((recRow.recovered / recRow.total).toFixed(4))
      : 0,
  };
}
