import * as dotenv from "dotenv";
import pg from "pg";

dotenv.config();
const cs = process.env.DATABASE_URL;
if (!cs) {
  console.error("No DATABASE_URL");
  process.exit(1);
}

async function main() {
  const c = new pg.Client({ connectionString: cs });
  await c.connect();

  const enums = await c.query(`
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    ORDER BY t.typname, e.enumsortorder
  `);
  console.log("public enums:", JSON.stringify(enums.rows, null, 2));

  const cols = await c.query(`
    SELECT c.table_name, c.column_name, c.data_type, c.udt_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name IN ('users', 'auth_identities')
    ORDER BY c.table_name, c.ordinal_position
  `);
  console.log("columns:", JSON.stringify(cols.rows, null, 2));

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
