import * as fs from 'fs';
import * as path from 'path';
import * as mysql from 'mysql2/promise';

/**
 * Loads .env variables manually to ensure reliable execution across different environments
 */
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const equalsIdx = trimmed.indexOf('=');
      if (equalsIdx !== -1) {
        const key = trimmed.substring(0, equalsIdx).trim();
        let value = trimmed.substring(equalsIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

async function runSync() {
  loadEnv();

  // Local database config
  const localConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'earthx_db',
  };

  // Production database config
  const prodConfig = {
    host: process.env.PROD_DB_HOST,
    port: Number(process.env.PROD_DB_PORT || 3306),
    user: process.env.PROD_DB_USERNAME,
    password: process.env.PROD_DB_PASSWORD,
    database: process.env.PROD_DB_DATABASE,
  };

  console.log('\n=============================================');
  console.log('      DATABASE SYNC: PRODUCTION -> LOCAL     ');
  console.log('=============================================\n');

  if (!prodConfig.host || !prodConfig.user || !prodConfig.database) {
    console.error('❌ Missing production database credentials in .env!');
    console.error('Please configure the following in your .env file:');
    console.error('  PROD_DB_HOST=your_prod_host');
    console.error('  PROD_DB_PORT=3306');
    console.error('  PROD_DB_USERNAME=your_prod_user');
    console.error('  PROD_DB_PASSWORD=your_prod_password');
    console.error('  PROD_DB_DATABASE=your_prod_dbname\n');
    process.exit(1);
  }

  console.log(`📡 Connecting to Production DB: [${prodConfig.host}:${prodConfig.port}/${prodConfig.database}]...`);
  let prodConn: mysql.Connection | null = null;
  try {
    prodConn = await mysql.createConnection({
      host: prodConfig.host,
      port: prodConfig.port,
      user: prodConfig.user,
      password: prodConfig.password,
      database: prodConfig.database,
      connectTimeout: 10000,
    });
    console.log('✅ Connected to Production DB.');
  } catch (err: any) {
    console.error('❌ Failed to connect to Production DB:', err.message);
    process.exit(1);
  }

  console.log(`💻 Connecting to Local DB: [${localConfig.host}:${localConfig.port}]...`);
  let localConn: mysql.Connection | null = null;
  try {
    // First connect without specifying database to create it if it doesn't exist
    const initialConn = await mysql.createConnection({
      host: localConfig.host,
      port: localConfig.port,
      user: localConfig.user,
      password: localConfig.password,
      connectTimeout: 5000,
    });

    await initialConn.query(`CREATE DATABASE IF NOT EXISTS \`${localConfig.database}\`;`);
    await initialConn.end();

    // Now connect to the specific local database
    localConn = await mysql.createConnection({
      host: localConfig.host,
      port: localConfig.port,
      user: localConfig.user,
      password: localConfig.password,
      database: localConfig.database,
    });
    console.log(`✅ Connected to Local DB (database: "${localConfig.database}").\n`);
  } catch (err: any) {
    console.error('❌ Failed to connect to Local DB:', err.message);
    if (prodConn) await prodConn.end();
    process.exit(1);
  }

  try {
    // Disable FK checks on local DB during sync
    await localConn.query('SET FOREIGN_KEY_CHECKS = 0;');

    // Get list of all tables from production
    const [tablesResult] = await prodConn.query<mysql.RowDataPacket[]>('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');
    const tableNames = tablesResult.map((row) => Object.values(row)[0] as string);

    if (tableNames.length === 0) {
      console.log('⚠️ No tables found in production database.');
      return;
    }

    console.log(`📋 Found ${tableNames.length} tables to synchronize:\n`);

    for (const tableName of tableNames) {
      process.stdout.write(`  ⏳ Syncing table "${tableName}"... `);

      // 1. Fetch Create Table statement from production
      const [createTableResult] = await prodConn.query<mysql.RowDataPacket[]>(`SHOW CREATE TABLE \`${tableName}\``);
      const createTableSql = createTableResult[0]['Create Table'];

      // 2. Drop and recreate table in local DB
      await localConn.query(`DROP TABLE IF EXISTS \`${tableName}\``);
      await localConn.query(createTableSql);

      // 3. Fetch data from production in chunks
      const [rows] = await prodConn.query<mysql.RowDataPacket[]>(`SELECT * FROM \`${tableName}\``);

      if (rows.length > 0) {
        // Insert rows in batches of 100
        const batchSize = 100;
        const columns = Object.keys(rows[0]);
        const escapedColumns = columns.map((col) => `\`${col}\``).join(', ');

        for (let i = 0; i < rows.length; i += batchSize) {
          const chunk = rows.slice(i, i + batchSize);
          const valuesPlaceholder = chunk
            .map(() => `(${columns.map(() => '?').join(', ')})`)
            .join(', ');

          const flatValues: any[] = [];
          for (const row of chunk) {
            for (const col of columns) {
              flatValues.push(row[col]);
            }
          }

          const insertSql = `INSERT INTO \`${tableName}\` (${escapedColumns}) VALUES ${valuesPlaceholder}`;
          await localConn.query(insertSql, flatValues);
        }
      }

      console.log(`✅ Done (${rows.length} rows synced)`);
    }

    // Re-enable FK checks
    await localConn.query('SET FOREIGN_KEY_CHECKS = 1;');

    console.log('\n🎉 =============================================');
    console.log('   DATA SYNC COMPLETED SUCCESSFULLY!');
    console.log('   Your local database is now identical to Production.');
    console.log('=============================================\n');
  } catch (syncError: any) {
    console.error('\n❌ Error during database synchronization:', syncError.message);
  } finally {
    if (prodConn) await prodConn.end();
    if (localConn) {
      try {
        await localConn.query('SET FOREIGN_KEY_CHECKS = 1;');
      } catch {}
      await localConn.end();
    }
  }
}

runSync();
