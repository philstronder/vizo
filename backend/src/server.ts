import { app } from "./app";
import { env } from "./lib/env";

app.listen(env.port, () => {
  console.log(`VIZO API listening on http://localhost:${env.port} (${env.nodeEnv})`);
});
