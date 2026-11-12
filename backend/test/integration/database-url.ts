// The database integration tests run against. Defaults to a vizo_test
// database on the docker-compose Postgres; override with TEST_DATABASE_URL.
export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://vizo:vizo@localhost:5433/vizo_test";
