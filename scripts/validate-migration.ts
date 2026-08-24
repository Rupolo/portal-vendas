import fs from "fs";
import path from "path";

/**
 * Migration Validation Script
 * 
 * Validates that the initial migration was created correctly with:
 * - All required tables
 * - Proper indexes
 * - Foreign key constraints
 * - Prisma client generation
 */

interface ValidationResult {
  passed: boolean;
  checks: {
    name: string;
    passed: boolean;
    error?: string;
  }[];
}

function validateMigration(): ValidationResult {
  const results: ValidationResult = {
    passed: true,
    checks: [],
  };

  const migrationPath = path.join(
    __dirname,
    "../prisma/migrations/0_init/migration.sql"
  );
  const prismaGeneratedPath = path.join(__dirname, "../src/generated/prisma");

  // Check 1: Migration file exists
  const check1 = {
    name: "Migration file exists",
    passed: fs.existsSync(migrationPath),
  };
  if (!check1.passed) {
    check1.error = `Migration file not found at ${migrationPath}`;
  }
  results.checks.push(check1);

  // Check 2: Migration file has content
  if (check1.passed) {
    const stats = fs.statSync(migrationPath);
    const check2 = {
      name: "Migration file has content (size > 1000 bytes)",
      passed: stats.size > 1000,
    };
    if (!check2.passed) {
      check2.error = `Migration file is too small: ${stats.size} bytes`;
    }
    results.checks.push(check2);
  }

  if (check1.passed) {
    const migrationContent = fs.readFileSync(migrationPath, "utf8");

    // Check 3: All required tables
    const requiredTables = [
      "Product",
      "MarketplaceProduct",
      "Inventory",
      "MarketplaceAuth",
      "MarketplaceConfig",
      "Order",
      "OrderItem",
      "ProductSyncLog",
      "OrderSyncLog",
      "ConflictLog",
      "WebhookDelivery",
      "SyncEvent",
      "DLQJob",
      "ErrorLog",
      "SyncMetrics",
    ];

    const missingTables: string[] = [];
    requiredTables.forEach((table) => {
      if (!migrationContent.includes(`CREATE TABLE "${table}"`)) {
        missingTables.push(table);
      }
    });

    const check3 = {
      name: `All ${requiredTables.length} required tables present`,
      passed: missingTables.length === 0,
    };
    if (!check3.passed) {
      check3.error = `Missing tables: ${missingTables.join(", ")}`;
    }
    results.checks.push(check3);

    // Check 4: Indexes for performance
    const requiredIndexes = [
      "Product_vendorId_idx",
      "Product_sku_idx",
      "Order_vendorId_idx",
      "Order_status_idx",
      "Inventory_productId_key",
      "MarketplaceAuth_expiresAt_idx",
    ];

    const missingIndexes: string[] = [];
    requiredIndexes.forEach((index) => {
      if (!migrationContent.includes(`"${index}"`)) {
        missingIndexes.push(index);
      }
    });

    const check4 = {
      name: `Performance indexes present (${requiredIndexes.length})`,
      passed: missingIndexes.length === 0,
    };
    if (!check4.passed) {
      check4.error = `Missing indexes: ${missingIndexes.join(", ")}`;
    }
    results.checks.push(check4);

    // Check 5: Foreign key constraints
    const requiredForeignKeys = [
      "MarketplaceProduct_productId_fkey",
      "Inventory_productId_fkey",
      "OrderItem_orderId_fkey",
    ];

    const missingForeignKeys: string[] = [];
    requiredForeignKeys.forEach((fk) => {
      if (!migrationContent.includes(`"${fk}"`)) {
        missingForeignKeys.push(fk);
      }
    });

    const check5 = {
      name: `Foreign key constraints present (${requiredForeignKeys.length})`,
      passed: missingForeignKeys.length === 0,
    };
    if (!check5.passed) {
      check5.error = `Missing foreign keys: ${missingForeignKeys.join(", ")}`;
    }
    results.checks.push(check5);

    // Check 6: CASCADE delete
    const check6 = {
      name: "CASCADE delete configured for data integrity",
      passed: migrationContent.includes("ON DELETE CASCADE"),
    };
    if (!check6.passed) {
      check6.error = "CASCADE delete not found in migration";
    }
    results.checks.push(check6);

    // Check 7: JSONB fields for flexible schema
    const check7 = {
      name: "JSONB fields for flexible data schema",
      passed:
        migrationContent.includes('"attributes" JSONB') &&
        migrationContent.includes('"images" JSONB') &&
        migrationContent.includes('"payload" JSONB'),
    };
    if (!check7.passed) {
      check7.error = "Required JSONB fields not found";
    }
    results.checks.push(check7);

    // Check 8: PostgreSQL data types
    const check8 = {
      name: "Proper PostgreSQL data types",
      passed:
        migrationContent.includes("TEXT") &&
        migrationContent.includes("DOUBLE PRECISION") &&
        migrationContent.includes("INTEGER") &&
        migrationContent.includes("BOOLEAN") &&
        migrationContent.includes("TIMESTAMP") &&
        migrationContent.includes("JSONB"),
    };
    if (!check8.passed) {
      check8.error = "Required PostgreSQL data types not found";
    }
    results.checks.push(check8);
  }

  // Check 9: Prisma client generated
  const check9 = {
    name: "Prisma client generated",
    passed: fs.existsSync(prismaGeneratedPath),
  };
  if (!check9.passed) {
    check9.error = `Prisma client not found at ${prismaGeneratedPath}`;
  }
  results.checks.push(check9);

  // Check 10: Generated index.d.ts
  if (check9.passed) {
    const indexPath = path.join(prismaGeneratedPath, "index.d.ts");
    const check10 = {
      name: "Prisma type definitions generated (index.d.ts)",
      passed: fs.existsSync(indexPath),
    };
    if (!check10.passed) {
      check10.error = "index.d.ts not found";
    }
    results.checks.push(check10);

    if (check10.passed) {
      const typesContent = fs.readFileSync(indexPath, "utf8");
      const requiredModels = [
        "Product",
        "MarketplaceProduct",
        "Inventory",
        "Order",
      ];

      const missingModels: string[] = [];
      requiredModels.forEach((model) => {
        if (!typesContent.includes(model)) {
          missingModels.push(model);
        }
      });

      const check11 = {
        name: `Required model types generated (${requiredModels.length})`,
        passed: missingModels.length === 0,
      };
      if (!check11.passed) {
        check11.error = `Missing models: ${missingModels.join(", ")}`;
      }
      results.checks.push(check11);
    }
  }

  // Overall result
  results.passed = results.checks.every((c) => c.passed);

  return results;
}

function main() {
  console.log("🔍 Migration Validation\n");
  console.log("═".repeat(60));

  const results = validateMigration();

  results.checks.forEach((check) => {
    const icon = check.passed ? "✓" : "✗";
    const color = check.passed ? "\x1b[32m" : "\x1b[31m";
    const reset = "\x1b[0m";
    
    console.log(`${color}${icon}${reset} ${check.name}`);
    if (check.error) {
      console.log(`  └─ Error: ${check.error}`);
    }
  });

  console.log("═".repeat(60));
  
  if (results.passed) {
    console.log("\n✓ All validation checks passed!");
    console.log("\nMigration Status:");
    console.log("  • Initial migration created: ✓");
    console.log("  • Database schema defined: ✓");
    console.log("  • Prisma types generated: ✓");
    console.log("  • Ready for database deployment: ✓");
    process.exit(0);
  } else {
    const failedCount = results.checks.filter((c) => !c.passed).length;
    console.log(`\n✗ Validation failed: ${failedCount} check(s) failed`);
    process.exit(1);
  }
}

main();
