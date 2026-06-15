import { Router } from 'express';
import axios from 'axios';
import config from '../config/index.js';
import logger from '../config/logger.js';
import { triggerSchema, outcomeSchema } from '../validation/schemas.js';
import { tierRouter } from '../services/tierRouter.js';
import { offerEngine } from '../services/offerEngine.js';
import { channelRouter } from '../services/channelRouter.js';
import { messageGenerator, checkMistralHealth } from '../services/messageGenerator.js';
import { sendEmail, verifySmtp } from '../email/mailer.js';
import {
  getCustomerById,
  getLastInterventionResponse,
  insertIntervention,
  updateEmailDelivered,
  insertOutcome,
  getInterventionHistory,
  getStats,
  getWeeklyRates,
} from '../db/queries.js';
import pool from '../db/pool.js';

const router = Router();

// ─────────────────────────────────────────────────────
// POST /intervention/trigger
// ─────────────────────────────────────────────────────
router.post('/trigger', async (req, res, next) => {
  try {
 
    const parseResult = triggerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        issues: parseResult.error.issues,
      });
    }

    const data = parseResult.data;
    const {
      customer_id,
      delinquency_prob,
      top_3_shap_reasons,
      customer_features,
      model_version,
      dry_run,
    } = data;

    // 2. Get customer from DB
    const customer = await getCustomerById(customer_id);
    if (!customer) {
      return res.status(404).json({
        error: 'Customer not found',
        customer_id,
      });
    }

    // 3. Get past offer response
    const pastOfferResponse = await getLastInterventionResponse(customer_id);

    // 4. Determine risk tier
    const tierResult = tierRouter(delinquency_prob);

    // 5. If stable — return early, no action
    if (tierResult.tier === 'stable') {
      logger.info('No action required — stable tier', {
        customer_id,
        delinquency_prob,
      });
      return res.status(200).json({
        status: 'no_action_required',
        customer_id,
        tier: tierResult.tier,
      });
    }

    // 6. Select offer
    const offer = offerEngine(
      tierResult.tier,
      customer_features.customer_segment,
      customer_features.emi_to_income_ratio
    );

    // 7. Route channel
    const channel = channelRouter(
      tierResult.tier,
      customer_features.customer_segment,
      customer_features.geography,
      pastOfferResponse
    );

    // 8. Generate message via Mistral AI
    const message = await messageGenerator({
      tier: tierResult.tier,
      offer,
      channel,
      shapReasons: top_3_shap_reasons,
      customerSegment: customer_features.customer_segment,
      customerName: customer.name.split(' ')[0], // first name
    });

    // 9. Send email
    let emailSent = false;
    let emailDelivered = false;
    if (channel.email_type) {
      const emailResult = await sendEmail({
        to: customer.email,
        subject: message.subject,
        body: message.body,
        dryRun: dry_run,
      });
      emailSent = emailResult.sent;
      emailDelivered = emailResult.delivered;
    }

    // 10. Insert intervention log (skip if dry_run)
    let interventionId = null;
    if (!dry_run) {
      try {
        interventionId = await insertIntervention({
          customer_id,
          risk_tier: tierResult.tier,
          delinquency_prob,
          offer_type: offer.offer_type,
          channel: channel.channel,
          email_type: channel.email_type,
          message_sent: message.body,
          email_subject: message.subject,
          model_version,
          dry_run,
        });

        // 11. Update email_delivered status
        if (emailDelivered) {
          await updateEmailDelivered(interventionId);
        }
      } catch (dbErr) {
        logger.error('DB write failed for intervention', {
          error: dbErr.message,
          customer_id,
        });
        // Continue — email was already sent
      }
    }

    // 12. Log
    logger.info('Intervention triggered', {
      customer_id,
      tier: tierResult.tier,
      offer_type: offer.offer_type,
      email_type: channel.email_type,
      model_version,
      dry_run,
      intervention_id: interventionId,
    });

    // 13. Response
    return res.status(200).json({
      customer_id,
      intervention_id: interventionId,
      risk_tier: tierResult.tier,
      urgency_score: tierResult.urgency_score,
      tier_label: tierResult.tier_label,
      offer: {
        offer_type: offer.offer_type,
        offer_description: offer.offer_description,
        validity_days: offer.validity_days,
        escalation_path: offer.escalation_path,
      },
      channel: {
        channel: channel.channel,
        email_type: channel.email_type,
        priority: channel.priority,
        best_time_to_send: channel.best_time_to_send,
        follow_up_in_days: channel.follow_up_in_days,
      },
      message: {
        subject: message.subject,
        body: message.body,
        word_count: message.word_count,
        tone: message.tone,
        email_type: message.email_type,
      },
      email_sent: emailSent,
      email_delivered: emailDelivered,
      dry_run,
      model_version,
      triggered_at: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// POST /intervention/outcome
// ─────────────────────────────────────────────────────
router.post('/outcome', async (req, res, next) => {
  try {
    const parseResult = outcomeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        issues: parseResult.error.issues,
      });
    }

    const data = parseResult.data;
    await insertOutcome(data);

    const stats = await getWeeklyRates();

    logger.info('Outcome recorded', {
      intervention_id: data.intervention_id,
      customer_id: data.customer_id,
      offer_accepted: data.offer_accepted,
    });

    return res.status(200).json({
      success: true,
      stats,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// GET /intervention/history/:customer_id
// ─────────────────────────────────────────────────────
router.get('/history/:customer_id', async (req, res, next) => {
  try {
    const { customer_id } = req.params;
    const history = await getInterventionHistory(customer_id);
    return res.status(200).json(history);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// GET /intervention/stats
// ─────────────────────────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getStats();
    return res.status(200).json(stats);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// GET /intervention/health
// ─────────────────────────────────────────────────────
router.get('/health', async (req, res) => {
  const checks = {
    postgres: 'disconnected',
    mistral_api: 'unreachable',
    gmail_smtp: 'disconnected',
    fastapi_backend: 'unreachable',
  };

  // Check PostgreSQL
  try {
    await pool.query('SELECT 1');
    checks.postgres = 'connected';
  } catch {
    // stays disconnected
  }

  // Check Mistral API
  try {
    const mistralOk = await checkMistralHealth();
    checks.mistral_api = mistralOk ? 'reachable' : 'unreachable';
  } catch {
    // stays unreachable
  }

  // Check Gmail SMTP
  try {
    const smtpOk = await verifySmtp();
    checks.gmail_smtp = smtpOk ? 'connected' : 'disconnected';
  } catch {
    // stays disconnected
  }

  // Check FastAPI backend
  try {
    await axios.get(`${config.fastapiBaseUrl}/health`, { timeout: 2000 });
    checks.fastapi_backend = 'reachable';
  } catch {
    // stays unreachable
  }

  const allOk = Object.values(checks).every(
    (v) => v === 'connected' || v === 'reachable'
  );

  return res.status(200).json({
    status: allOk ? 'ok' : 'degraded',
    ...checks,
  });
});

export default router;
