/**
 * Attribute Sync Service
 * ======================
 * 
 * Handles mapping of Portal Vendas product attributes to marketplace-specific
 * attributes for Shopee and Mercado Livre. Provides validation, fallback values,
 * and manual override support.
 * 
 * Features:
 * - Marketplace-specific attribute mapping
 * - Required attribute validation
 * - Fallback values for missing attributes
 * - Manual override capability
 * - Attribute group organization
 * 
 * @see config.ts for marketplace attribute configuration
 * @see product-sync.service.ts for product synchronization
 * 
 * Requirements: 7, 11
 * Effort: 2.5 hours
 */

import { config } from '../config';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Marketplace attribute configuration
 */
export interface MarketplaceAttributeConfig {
  required: string[];
  optional: string[];
  mappings: Record<string, string | string[]>; // Portal attr → Marketplace attr(s)
  defaultValue?: Record<string, any>;
  validators?: Record<string, (value: any) => boolean>;
}

/**
 * Attribute mapping result
 */
export interface AttributeMappingResult {
  marketplaceAttributes: Record<string, any>;
  missingRequired: string[];
  invalidValues: Record<string, string>;
  mappedCount: number;
  warnings: string[];
}

/**
 * Attribute validation result
 */
export interface AttributeValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Portal attribute value with source info
 */
export interface AttributeValue {
  value: any;
  source: 'portal' | 'fallback' | 'manual';
  timestamp: Date;
}

/**
 * Attribute sync options
 */
export interface AttributeSyncOptions {
  marketplace: 'shopee' | 'mercadolivre';
  allowManualOverride?: boolean;
  useFallbacks?: boolean;
  customMappings?: Record<string, string>;
}

// ============================================================================
// ATTRIBUTE SYNC SERVICE
// ============================================================================

export class AttributeSyncService {
  // ============================================================================
  // MARKETPLACE ATTRIBUTE CONFIGURATION
  // ============================================================================

  /**
   * Shopee marketplace attribute configuration
   */
  private shopeeConfig: MarketplaceAttributeConfig = {
    required: ['brand', 'model', 'color', 'packageContent'],
    optional: [
      'size',
      'weight',
      'material',
      'origin',
      'warranty',
      'condition',
      'specification',
    ],
    mappings: {
      brand: ['brand', 'marca'],
      model: ['model', 'modelo'],
      color: ['color', 'cor', 'cores'],
      packageContent: ['packageContent', 'conteudo', 'itemIncluded'],
      size: ['size', 'tamanho'],
      weight: ['weight', 'peso'],
      material: ['material', 'material'],
      origin: ['origin', 'origem'],
      warranty: ['warranty', 'garantia'],
      condition: ['condition', 'condicao'],
      specification: ['specification', 'especificacao'],
    },
    defaultValue: {
      brand: 'Generic',
      model: 'Model No.',
      color: 'Multiple',
      packageContent: '1 x Product',
    },
  };

  /**
   * Mercado Livre marketplace attribute configuration
   */
  private mercadoLivreConfig: MarketplaceAttributeConfig = {
    required: ['brand', 'model', 'condition'],
    optional: [
      'color',
      'size',
      'weight',
      'material',
      'warranty',
      'height',
      'width',
      'depth',
    ],
    mappings: {
      brand: ['brand', 'marca'],
      model: ['model', 'modelo'],
      condition: ['condition', 'condicao', 'status'],
      color: ['color', 'cor', 'cores'],
      size: ['size', 'tamanho'],
      weight: ['weight', 'peso'],
      material: ['material', 'material'],
      warranty: ['warranty', 'garantia'],
      height: ['height', 'altura'],
      width: ['width', 'largura'],
      depth: ['depth', 'profundidade'],
    },
    defaultValue: {
      brand: 'Generic',
      model: 'Modelo',
      condition: 'new',
      color: 'Multicor',
    },
  };

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  /**
   * Sync attributes to marketplace format
   * 
   * Maps Portal attributes to the specific format required by each marketplace,
   * validates required attributes, and applies fallback values.
   * 
   * @param portalAttributes - Portal product attributes
   * @param marketplace - Target marketplace
   * @param options - Sync options
   * @returns Mapping result with marketplace attributes and validation info
   * 
   * @example
   * ```typescript
   * const result = attributeSyncService.syncAttributes(
   *   { brand: 'Apple', model: 'iPhone', color: 'Black' },
   *   'shopee'
   * );
   * 
   * console.log(result.marketplaceAttributes);
   * // { brand: 'Apple', model: 'iPhone', color: 'Black', ... }
   * 
   * if (result.missingRequired.length > 0) {
   *   console.warn('Missing required attributes:', result.missingRequired);
   * }
   * ```
   */
  syncAttributes(
    portalAttributes: Record<string, any>,
    marketplace: 'shopee' | 'mercadolivre',
    options: AttributeSyncOptions = {}
  ): AttributeMappingResult {
    const config = this.getMarketplaceConfig(marketplace);
    const {
      allowManualOverride = false,
      useFallbacks = true,
      customMappings = {},
    } = options;

    const marketplaceAttributes: Record<string, any> = {};
    const missingRequired: string[] = [];
    const invalidValues: Record<string, string> = {};
    const warnings: string[] = [];

    // Combine default, custom, and portal mappings
    const mappings = { ...config.mappings, ...customMappings };

    // Process each portal attribute
    for (const [portalKey, portalValue] of Object.entries(portalAttributes)) {
      const mappedKeys = this.getMappedKeys(portalKey, mappings);

      for (const mappedKey of mappedKeys) {
        if (portalValue !== undefined && portalValue !== null) {
          marketplaceAttributes[mappedKey] = this.normalizeAttributeValue(
            portalValue,
            mappedKey,
            marketplace
          );
        }
      }
    }

    // Check required attributes
    for (const requiredAttr of config.required) {
      const mappedKeys = this.getMappedKeys(requiredAttr, mappings);
      const hasValue = mappedKeys.some(key => marketplaceAttributes[key]);

      if (!hasValue) {
        if (useFallbacks && config.defaultValue?.[requiredAttr] !== undefined) {
          // Apply fallback value
          const fallbackValue = config.defaultValue[requiredAttr];
          const mappedKeys = this.getMappedKeys(requiredAttr, mappings);
          for (const mappedKey of mappedKeys) {
            marketplaceAttributes[mappedKey] = fallbackValue;
          }
          warnings.push(`Applied fallback for required attribute: ${requiredAttr}`);
        } else {
          missingRequired.push(requiredAttr);
        }
      }
    }

    // Validate values
    for (const [attr, value] of Object.entries(marketplaceAttributes)) {
      const validator = config.validators?.[attr];
      if (validator && !validator(value)) {
        invalidValues[attr] = `Invalid value for ${attr}: ${value}`;
        warnings.push(invalidValues[attr]);
      }
    }

    const mappedCount = Object.keys(marketplaceAttributes).length;

    return {
      marketplaceAttributes,
      missingRequired,
      invalidValues,
      mappedCount,
      warnings,
    };
  }

  /**
   * Validate attributes for marketplace
   * 
   * Checks if all required attributes are present and valid
   * 
   * @param portalAttributes - Portal attributes
   * @param marketplace - Target marketplace
   * @param options - Validation options
   * @returns Validation result with errors and warnings
   */
  validateAttributes(
    portalAttributes: Record<string, any>,
    marketplace: 'shopee' | 'mercadolivre',
    options: AttributeSyncOptions = {}
  ): AttributeValidationResult {
    const config = this.getMarketplaceConfig(marketplace);
    const { useFallbacks = true } = options;

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required attributes
    for (const requiredAttr of config.required) {
      const mappedKeys = this.getMappedKeys(requiredAttr, config.mappings);
      const hasValue = mappedKeys.some(
        key => portalAttributes[key] !== undefined && portalAttributes[key] !== null
      );

      if (!hasValue) {
        if (useFallbacks && config.defaultValue?.[requiredAttr] !== undefined) {
          warnings.push(`Missing required attribute: ${requiredAttr} (will use fallback)`);
        } else {
          errors.push(`Missing required attribute: ${requiredAttr}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get required attributes for marketplace
   * 
   * @param marketplace - Target marketplace
   * @returns Array of required attribute names
   */
  getRequiredAttributes(marketplace: 'shopee' | 'mercadolivre'): string[] {
    const config = this.getMarketplaceConfig(marketplace);
    return [...config.required];
  }

  /**
   * Get optional attributes for marketplace
   * 
   * @param marketplace - Target marketplace
   * @returns Array of optional attribute names
   */
  getOptionalAttributes(marketplace: 'shopee' | 'mercadolivre'): string[] {
    const config = this.getMarketplaceConfig(marketplace);
    return [...config.optional];
  }

  /**
   * Get marketplace-specific attribute keys
   * 
   * Given a Portal attribute key, returns all possible marketplace keys
   * 
   * @param portalKey - Portal attribute key
   * @param mappings - Attribute mappings
   * @returns Array of marketplace attribute keys
   */
  getMappedKeys(
    portalKey: string,
    mappings: Record<string, string | string[]>
  ): string[] {
    const keys: string[] = [];

    for (const [pattern, mappedValue] of Object.entries(mappings)) {
      if (this.matchesPattern(portalKey, pattern)) {
        if (Array.isArray(mappedValue)) {
          keys.push(...mappedValue);
        } else {
          keys.push(mappedValue);
        }
      }
    }

    return keys;
  }

  /**
   * Check if portal key matches pattern
   */
  private matchesPattern(portalKey: string, pattern: string): boolean {
    // Exact match
    if (portalKey.toLowerCase() === pattern.toLowerCase()) {
      return true;
    }

    // Partial match
    if (portalKey.toLowerCase().includes(pattern.toLowerCase())) {
      return true;
    }

    return false;
  }

  /**
   * Normalize attribute value for marketplace
   */
  private normalizeAttributeValue(
    value: any,
    attributeName: string,
    marketplace: 'shopee' | 'mercadolivre'
  ): any {
    // String normalization
    if (typeof value === 'string') {
      return value.trim();
    }

    // Number normalization
    if (typeof value === 'number') {
      return Math.round(value * 100) / 100; // 2 decimal places
    }

    // Array handling
    if (Array.isArray(value)) {
      return value.map(v => this.normalizeAttributeValue(v, attributeName, marketplace));
    }

    return value;
  }

  /**
   * Get marketplace configuration
   */
  private getMarketplaceConfig(marketplace: 'shopee' | 'mercadolivre'): MarketplaceAttributeConfig {
    switch (marketplace) {
      case 'shopee':
        return this.shopeeConfig;
      case 'mercadolivre':
        return this.mercadoLivreConfig;
      default:
        throw new Error(`Unsupported marketplace: ${marketplace}`);
    }
  }

  /**
   * Get fallback value for attribute
   * 
   * @param attributeName - Attribute name
   * @param marketplace - Target marketplace
   * @returns Fallback value or null if not defined
   */
  getFallbackValue(attributeName: string, marketplace: 'shopee' | 'mercadolivre'): any {
    const config = this.getMarketplaceConfig(marketplace);
    return config.defaultValue?.[attributeName] ?? null;
  }

  /**
   * Get attribute mapping direction
   * 
   * Returns the mapping from Portal attribute to Marketplace attribute
   * 
   * @param portalAttribute - Portal attribute name
   * @param marketplace - Target marketplace
   * @returns Marketplace attribute name(s) or null if not mapped
   */
  getAttributeMapping(
    portalAttribute: string,
    marketplace: 'shopee' | 'mercadolivre'
  ): string | string[] | null {
    const config = this.getMarketplaceConfig(marketplace);
    const mappedKeys = this.getMappedKeys(portalAttribute, config.mappings);
    return mappedKeys.length > 0 ? mappedKeys[0] : null;
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

/**
 * Singleton instance of AttributeSyncService
 * 
 * Use this instance throughout the application for attribute synchronization
 */
export const attributeSyncService = new AttributeSyncService();

export default attributeSyncService;
