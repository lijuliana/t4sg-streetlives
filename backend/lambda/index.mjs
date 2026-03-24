import pg from 'pg';
const { Client } = pg;

export const handler = async (event) => {
  const client = new Client({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: 5432,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  const res = await client.query('SELECT NOW()');
  await client.end();

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      message: "Streetlives API is live",
      db_time: res.rows[0] 
    }),
  };
};