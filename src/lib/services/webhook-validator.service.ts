/**
 * Webhook Validator Service
 * Validates webhook signatures from Shopee and Mercado Livre
 * Uses HMAC-SHA256 for Shopee, token validation for ML
 */

import crypto from 'crypto';
import { timingSafeEqual } from 'crypto';
import type { Marketplace } from '../types';

export class WebhookValidatorService {
  /**
   * Validate Shopee webhook signature (HMAC-SHA256)
   */
  validateShopeeSignature(
    body: string,
    timestamp: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      // Shopee uses: HMAC-SHA256(body + timestamp, secret)
      const data = body + timestamp;
      const expectedSignature = crypto.createHmac('sha256', secret).update(data).digest('hex');

      return this.timingSafeEqualWrapper(signature, expectedSignature);
    } catch (error) {
      console.error('[WebhookValidator] Shopee validation error:', error);
      return false;
    }
  }

  /**
   * Validate Mercado Livre webhook signature (HMAC-SHA256)
   */
  validateMercadoLivreSignature(
    body: string,
    xSignature: string,
    secret: string
  ): boolean {
    try {
      // ML format: "sha256=<signature>"
      const parts = xSignature.split('=');

      if (parts.length !== 2 || parts[0] !== 'sha256') {
        return false;
      }

      const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('base64');
      const providedSignature = Buffer.from(parts[1], 'base64').toString('hex');
      const expectedHex = Buffer.from(expectedSignature, 'base64').toString('hex');

      return this.timingSafeEqualWrapper(providedSignature, expectedHex);
    } catch (error) {
      console.error('[WebhookValidator] Mercado Livre validation error:', error);
      return false;
    }
  }

  /**
   * Validate webhook token (alternative method for some marketplaces)
   */
  validateToken(providedToken: string, expectedToken: string): boolean {
    try {
      return this.timingSafeEqualWrapper(providedToken, expectedToken);
    } catch (error) {
      console.error('[WebhookValidator] Token validation error:', error);
      return false;
    }
  }

  /**
   * Timing-safe string comparison
   * Prevents timing attacks
   */
  private timingSafeEqualWrapper(a: string, b: string): boolean {
    try {
      const bufferA = Buffer.from(a);
      const bufferB = Buffer.from(b);

      // If lengths are different, return false (and use a constant-time check still)
      if (bufferA.length !== bufferB.length) {
        return false;
      }

      return timingSafeEqual(bufferA, bufferB);
    } catch {
      return false;
    }
  }

  /**
   * Validate webhook based on marketplace
   */
  validateWebhook(
    marketplace: Marketplace,
    payload: {
      body: string;
      signature?: string;
      timestamp?: string;
      xSignature?: string;
      token?: string;
    },
    secrets: {
      webhookSecret?: string;
      webhookToken?: string;
    }
  ): { isValid: boolean; error?: string } {
    try {
      if (marketplace === 'shopee') {
        if (!payload.body || !payload.timestamp || !payload.signature) {
          return {
            isValid: false,
            error: 'Missing required Shopee webhook fields',
          };
        }

        if (!secrets.webhookSecret) {
          return {
            isValid: false,
            error: 'Shopee webhook secret not configured',
          };
        }

        const isValid = this.validateShopeeSignature(
          payload.body,
          payload.timestamp,
          payload.signature,
          secrets.webhookSecret
        );

        return {
          isValid,
          error: isValid ? undefined : 'Invalid Shopee signature',
        };
      } else if (marketplace === 'mercadolivre') {
        if (!payload.body || !payload.xSignature) {
          return {
            isValid: false,
            error: 'Missing required Mercado Livre webhook fields',
          };
        }

        if (!secrets.webhookSecret) {
          return {
            isValid: false,
            error: 'Mercado Livre webhook secret not configured',
          };
        }

        const isValid = this.validateMercadoLivreSignature(
          payload.body,
          payload.xSignature,
          secrets.webhookSecret
        );

        return {
          isValid,
          error: isValid ? undefined : 'Invalid Mercado Livre signature',
        };
      }

      return {
        isValid: false,
        error: `Unknown marketplace: ${marketplace}`,
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      };
    }
  }

  /**
   * Extract webhook ID from payload
   */
  extractWebhookId(marketplace: Marketplace, payload: Record<string, any>): string | null {
    try {
      if (marketplace === 'shopee') {
        // Shopee uses 'id' in webhook payload
        return payload.id || null;
      } else if (marketplace === 'mercadolivre') {
        // ML uses 'id' in webhook payload
        return payload.id || null;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Extract event type from payload
   */
  extractEventType(marketplace: Marketplace, payload: Record<string, any>): string | null {
    try {
      if (marketplace === 'shopee') {
        // Shopee uses 'event' in webhook payload
        return payload.event || payload.type || null;
      } else if (marketplace === 'mercadolivre') {
        // ML uses 'resource' or 'topic'
        return payload.resource || payload.topic || null;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Parse webhook payload safely
   */
  parseWebhookPayload(body: string): Record<string, any> | null {
    try {
      if (typeof body === 'string') {
        return JSON.parse(body);
      }

      return body as Record<string, any>;
    } catch (error) {
      console.error('[WebhookValidator] Failed to parse webhook payload:', error);
      return null;
    }
  }

  /**
   * Validate webhook payload structure
   */
  validatePayloadStructure(
    marketplace: Marketplace,
    payload: Record<string, any>
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (marketplace === 'shopee') {
      if (!payload.id) {
        errors.push('Missing webhook ID');
      }

      if (!payload.event && !payload.type) {
        errors.push('Missing event type');
      }

      if (!payload.data && !payload.payload) {
        errors.push('Missing payload data');
      }
    } else if (marketplace === 'mercadolivre') {
      if (!payload.id) {
        errors.push('Missing webhook ID');
      }

      if (!payload.resource && !payload.topic) {
        errors.push('Missing resource/topic');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
export const webhookValidatorService = new WebhookValidatorService();
