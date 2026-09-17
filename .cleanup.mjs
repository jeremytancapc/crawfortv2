import fs from "node:fs"; import pg from "pg";
for (const l of fs.readFileSync(".env.local","utf8").split("\n")) {
  const m=l.match(/^([A-Z_0-9]+)=(.*)$/); if(m) process.env[m[1]]=m[2].trim().replace(/^["']|["']$/g,"");
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Orphans: never got past activate — no assessment, no order.
const { rows: orphans } = await pool.query(`
  select a.id, to_char(a.created_at at time zone 'Asia/Singapore','HH24:MI:SS') at_sgt,
         a.status, a.nric
  from applicants a
  where a.status = 'in_progress'
    and not exists (select 1 from credit_assessments c where c.applicant_id = a.id)
    and not exists (select 1 from ascend_orders o where o.applicant_id = a.id)
  order by a.created_at`);
console.log("ORPHANED (activate only, never submitted):");
console.table(orphans);

// Everything else from today's testing.
const { rows: mine } = await pool.query(`
  select a.id, to_char(a.created_at at time zone 'Asia/Singapore','HH24:MI:SS') at_sgt, a.status, a.nric
  from applicants a where a.created_at::date = current_date order by a.created_at`);
console.log(`\nALL ROWS CREATED TODAY: ${mine.length}`);
console.table(mine);
await pool.end();
