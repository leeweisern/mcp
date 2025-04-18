import { Resource } from "sst"
import { Client } from "pg"

// Reporting DB
const pgReportingClient = new Client({
    host: Resource.PG_HOST.value,
    port: Number(Resource.PG_PORT.value),
    user: Resource.PG_USER.value,
    password: Resource.PG_PWD.value,
    database: Resource.PG_REPORTING_DB_NAME.value,
});
let pgReportingClientReady = false;
export async function ensurePgReportingClient() {
    if (!pgReportingClientReady) {
        await pgReportingClient.connect();
        pgReportingClientReady = true;
    }
}

// Every DB
const pgEveryClient = new Client({
    host: Resource.PG_HOST.value,
    port: Number(Resource.PG_PORT.value),
    user: Resource.PG_USER.value,
    password: Resource.PG_PWD.value,
    database: Resource.PG_EVERY_DB_NAME.value,
});
let pgEveryClientReady = false;
export async function ensurePgEveryClient() {
    if (!pgEveryClientReady) {
        await pgEveryClient.connect();
        pgEveryClientReady = true;
    }
}

export { pgReportingClient, pgEveryClient } 