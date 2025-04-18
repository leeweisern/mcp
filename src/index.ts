import { create } from "opencontrol"
import { tool } from "opencontrol/tool"
import { z } from "zod"
import * as AWS from "aws-sdk"
import { createAnthropic } from "@ai-sdk/anthropic"
import { handle } from "hono/aws-lambda"
import { Resource } from "sst"
import { Client } from "pg"
import { pgReportingClient, pgEveryClient, ensurePgReportingClient, ensurePgEveryClient } from "./db"

const aws = tool({
  name: "aws",
  description: "Make a call to the AWS SDK for JavaScript v2",
  args: z.object({
    client: z.string().describe("Class name of the client to use"),
    command: z.string().describe("Function to call on the AWS sdk client"),
    params: z.string().describe("Arguments to pass to the command as JSON"),
  }),
  async run(input) {
    // @ts-ignore - Consider adding proper typing or error handling for AWS client/command existence
    const client = AWS[input.client]
    if (!client) throw new Error(`Client ${input.client} not found`)
    const instance = new client()
    const cmd = instance[input.command]
    if (!cmd) throw new Error(`Command ${input.command} not found`)
    // It's safer to parse JSON inside a try/catch
    try {
      const params = JSON.parse(input.params);
      return await cmd(params).promise();
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error(`Invalid JSON parameters provided: ${e.message}`);
      }
      throw e; // Re-throw other errors
    }
  },
})

// Create an Anthropic provider with the API key from SST
const anthropicProvider = createAnthropic({
  apiKey: Resource.AnthropicKey.value
})

const database_query_readonly_reporting = tool({
  name: "database_query_readonly_reporting",
  description:
    "Readonly database query for PostgreSQL (reporting DB), use this if there are no direct tools",
  args: z.object({ query: z.string() }),
  async run(input) {
    await ensurePgReportingClient();
    return pgReportingClient.query('BEGIN READ ONLY').then(() =>
      pgReportingClient.query(input.query)
    ).then(result => {
      return pgReportingClient.query('COMMIT').then(() => result.rows)
    }).catch(async (err) => {
      await pgReportingClient.query('ROLLBACK');
      throw err;
    });
  },
})

const database_query_write_reporting = tool({
  name: "database_query_write_reporting",
  description:
    "DANGEROUS operation that writes to the reporting database. You MUST triple check with the user before using this tool - show them the query you are about to run.",
  args: z.object({ query: z.string() }),
  async run(input) {
    await ensurePgReportingClient();
    return pgReportingClient.query('BEGIN').then(() =>
      pgReportingClient.query(input.query)
    ).then(result => {
      return pgReportingClient.query('COMMIT').then(() => result.rows)
    }).catch(async (err) => {
      await pgReportingClient.query('ROLLBACK');
      throw err;
    });
  },
})

const database_query_readonly_every = tool({
  name: "database_query_readonly_every",
  description:
    "Readonly database query for PostgreSQL (every DB), use this if there are no direct tools",
  args: z.object({ query: z.string() }),
  async run(input) {
    await ensurePgEveryClient();
    return pgEveryClient.query('BEGIN READ ONLY').then(() =>
      pgEveryClient.query(input.query)
    ).then(result => {
      return pgEveryClient.query('COMMIT').then(() => result.rows)
    }).catch(async (err) => {
      await pgEveryClient.query('ROLLBACK');
      throw err;
    });
  },
})

const database_query_write_every = tool({
  name: "database_query_write_every",
  description:
    "DANGEROUS operation that writes to the every database. You MUST triple check with the user before using this tool - show them the query you are about to run.",
  args: z.object({ query: z.string() }),
  async run(input) {
    await ensurePgEveryClient();
    return pgEveryClient.query('BEGIN').then(() =>
      pgEveryClient.query(input.query)
    ).then(result => {
      return pgEveryClient.query('COMMIT').then(() => result.rows)
    }).catch(async (err) => {
      await pgEveryClient.query('ROLLBACK');
      throw err;
    });
  },
})

// Create the Hono app instance
const app = create({
  tools: [
    aws,
    database_query_readonly_reporting,
    database_query_write_reporting,
    database_query_readonly_every,
    database_query_write_every
  ],
  model: anthropicProvider("claude-3-7-sonnet-latest"),
  password: "password", // Consider using environment variables for password
})

// Export the handler function for Lambda
export const handler = handle(app)
