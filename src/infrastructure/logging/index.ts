import "server-only";

import pino from "pino";

export const appLogger = pino({
  level: "info",
  redact: {
    paths: ["apiKey", "headers.authorization", "portfolio", "providerPayload"],
    censor: "[REDACTED]",
  },
});
