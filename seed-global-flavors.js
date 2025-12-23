#!/usr/bin/env node

/**
 * Seed script: Load global flavors from CSV into PostgreSQL
 * Usage: node seed-global-flavors.js path/to/flavors.csv
 * 
 * CSV Format: name,brand,description,color,is_available
 */

import fs from 'fs';
import pg from 'pg';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config({ path: '.env.local' });
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedGlobalFlavors(csvPath) {
  if (!csvPath) {
    console.error('❌ Usage: node seed-global-flavors.js path/to/flavors.csv');
    process.exit(1);
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ File not found: ${csvPath}`);
    process.exit(1);
  }

  let client;

  try {
    // Read and parse CSV
    console.log(`📖 Reading CSV file: ${csvPath}`);
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true, // Handle UTF-8 BOM
    });

    console.log(`✅ Parsed ${records.length} flavors from CSV`);

    // Validate records
    const validRecords = records.filter(r => {
      if (!r.name || !r.brand) {
        console.warn(`⚠️  Skipping invalid record: ${JSON.stringify(r)}`);
        return false;
      }
      return true;
    });

    console.log(`✅ ${validRecords.length} valid records to insert`);

    // Connect to database
    client = await pool.connect();
    await client.query('BEGIN');

    // Clear existing global flavors (optional)
    const { rowCount: existingCount } = await client.query('SELECT COUNT(*) FROM global_flavors');
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing global flavors`);
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise(resolve => {
        rl.question('Delete existing flavors? (yes/no): ', resolve);
      });
      rl.close();

      if (answer.toLowerCase() === 'yes') {
        await client.query('TRUNCATE TABLE global_flavors CASCADE');
        console.log('✅ Cleared existing global flavors');
      } else {
        console.log('⚠️  Skipping existing flavors deletion');
      }
    }

    // Prepare batch insert
    const batchSize = 500;
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < validRecords.length; i += batchSize) {
      const batch = validRecords.slice(i, i + batchSize);
      
      const values = batch.map((record, idx) => {
        const baseIdx = i + idx;
        return `(
          $${baseIdx * 5 + 1},
          $${baseIdx * 5 + 2},
          $${baseIdx * 5 + 3},
          $${baseIdx * 5 + 4},
          $${baseIdx * 5 + 5}
        )`;
      }).join(',');

      const params = batch.flatMap(record => [
        randomUUID(),
        String(record.name).trim(),
        String(record.brand).trim(),
        String(record.description || '').trim() || null,
        String(record.color || '#10b981').trim(),
      ]);

      try {
        const query = `
          INSERT INTO global_flavors (id, name, brand, description, color)
          VALUES ${values}
          ON CONFLICT (brand, name) DO NOTHING
        `;
        
        const result = await client.query(query, params);
        inserted += result.rowCount;
        skipped += batch.length - result.rowCount;
        
        console.log(`📦 Batch ${Math.floor(i / batchSize) + 1}: inserted ${result.rowCount} / ${batch.length}`);
      } catch (err) {
        console.error(`❌ Batch ${Math.floor(i / batchSize) + 1} failed:`, err.message);
        throw err;
      }
    }

    await client.query('COMMIT');

    console.log('\n✅ Seed completed successfully!');
    console.log(`   - Inserted: ${inserted} flavors`);
    console.log(`   - Skipped (duplicates): ${skipped} flavors`);
    console.log(`   - Total in DB: ${inserted + skipped} flavors\n`);

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const csvPath = process.argv[2];
  seedGlobalFlavors(csvPath);
}

export { seedGlobalFlavors };
