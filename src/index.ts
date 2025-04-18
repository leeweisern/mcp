import { create } from "opencontrol"
import { tool } from "opencontrol/tool"
import { z } from "zod"
import * as AWS from "aws-sdk"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { handle } from "hono/aws-lambda"
import { Resource } from "sst"
import { pgReportingClient, pgEveryClient, ensurePgReportingClient, ensurePgEveryClient } from "./db"

const aws = tool({
  name: "aws",
  description: "Make a call to the AWS SDK for JavaScript v2. NOTE: Command names must be in lowerCamelCase (e.g., 'getCostAndUsage').",
  args: z.object({
    client: z.string().describe("Class name of the client to use (e.g., 'S3', 'CostExplorer')"),
    command: z.string().describe("Function to call on the AWS sdk client, in lowerCamelCase (e.g., 'listBuckets', 'getCostAndUsage')"),
    params: z.string().describe("Arguments to pass to the command as JSON"),
  }),
  async run(input) {
    // @ts-ignore - Consider adding proper typing or error handling for AWS client/command existence
    const client = AWS[input.client]
    if (!client) throw new Error(`Client ${input.client} not found`)
    // Explicitly set region from environment variables
    const instance = new client({ region: 'ap-southeast-1' });
    const cmd = instance[input.command]
    if (!cmd) throw new Error(`Command ${input.command} not found`)
    // It's safer to parse JSON inside a try/catch
    try {
      const params = JSON.parse(input.params);
      // Use .call() to ensure 'this' context is correct
      return await cmd.call(instance, params).promise();
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

const openaiProvider = createOpenAI({
  apiKey: Resource.OPENAI_KEY.value
})

const googleProvider = createGoogleGenerativeAI({
  apiKey: Resource.GOOGLE_KEY.value
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
    "Readonly database query for PostgreSQL (Every DB). For payment and transaction related queries, use tables: vw_payment_details and vw_transaction_details. IMPORTANT: Before filtering by 'payment_status' or 'transaction_status', ALWAYS query the DISTINCT available statuses from the relevant table first (e.g., 'SELECT DISTINCT payment_status FROM vw_payment_details;'). Do NOT assume common status values like 'SUCCESS', as they may not exist. Time in database is in UTC.",
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
  // model: googleProvider("gemini-2.5-pro-preview-03-25"),
  model: openaiProvider("gpt-4.1-mini"),
  // model: anthropicProvider("claude-3-7-sonnet-latest"),
})

// Export the handler function for Lambda
export const handler = handle(app)
