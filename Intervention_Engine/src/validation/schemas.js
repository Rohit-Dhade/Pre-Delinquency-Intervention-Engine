// ─────────────────────────────────────────────────────
// src/validation/schemas.js — Zod validation schemas
// ─────────────────────────────────────────────────────
import { z } from 'zod';

export const triggerSchema = z.object({
  customer_id: z.string().min(1, 'customer_id is required'),
  delinquency_prob: z.number().min(0).max(1),
  top_3_shap_reasons: z
    .array(
      z.object({
        feature: z.string(),
        feature_label: z.string(),
        feature_value: z.number(),
        shap_value: z.number(),
        direction: z.enum(['increases risk', 'decreases risk']),
      })
    )
    .min(1)
    .max(3),
  customer_features: z.object({
    emi_to_income_ratio: z.number(),
    customer_segment: z.enum(['salaried', 'self_employed', 'gig_worker']),
    geography: z.enum(['metro', 'urban', 'tier2', 'rural']),
  }),
  model_version: z.string(),
  dry_run: z.boolean().default(false),
});

export const outcomeSchema = z.object({
  intervention_id: z.number().int().positive(),
  customer_id: z.string().min(1, 'customer_id is required'),
  offer_accepted: z.boolean(),
  days_to_resolve: z.number().int().min(0),
  did_default_anyway: z.boolean(),
});

export const previewSchema = z.object({
  customer_id: z.string().min(1, 'customer_id is required'),
  delinquency_prob: z.number().min(0).max(1),
  top_3_shap_reasons: z
    .array(
      z.object({
        feature: z.string(),
        feature_label: z.string(),
        feature_value: z.number(),
        shap_value: z.number(),
        direction: z.enum(['increases risk', 'decreases risk']),
      })
    )
    .min(1)
    .max(3),
  customer_features: z.object({
    emi_to_income_ratio: z.number(),
    customer_segment: z.enum(['salaried', 'self_employed', 'gig_worker']),
    geography: z.enum(['metro', 'urban', 'tier2', 'rural']),
  }),
  model_version: z.string(),
});

export const sendSchema = z.object({
  customer_id: z.string().min(1, 'customer_id is required'),
  delinquency_prob: z.number().min(0).max(1),
  risk_tier: z.enum(['critical', 'moderate', 'watch']),
  offer: z.object({
    offer_type: z.string(),
    offer_description: z.string(),
    validity_days: z.number(),
    escalation_path: z.string(),
  }),
  channel: z.object({
    channel: z.string(),
    email_type: z.string(),
    priority: z.string().nullable().optional(),
    best_time_to_send: z.string().nullable().optional(),
    follow_up_in_days: z.number().nullable().optional(),
  }),
  subject: z.string().min(1, 'Email subject is required'),
  body: z.string().min(1, 'Email body is required'),
  model_version: z.string(),
  dry_run: z.boolean().default(false),
});

export default { triggerSchema, outcomeSchema, previewSchema, sendSchema };
