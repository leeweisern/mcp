/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "mcp",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
    };
  },
  async run() {
    const anthropicKey = new sst.Secret("AnthropicKey")
    const pgDbHost = new sst.Secret("PG_DB_HOST")
    const pgDbPassword = new sst.Secret("PG_DB_PASSWORD")
    const pgDbPort = new sst.Secret("PG_DB_PORT")
    const pgDbReadHost = new sst.Secret("PG_DB_READ_HOST")
    const pgDbUser = new sst.Secret("PG_DB_USER")
    const pgEveryDbName = new sst.Secret("PG_EVERY_DB_NAME")
    const pgHost = new sst.Secret("PG_HOST")
    const pgPort = new sst.Secret("PG_PORT")
    const pgPwd = new sst.Secret("PG_PWD")
    const pgReportingDbName = new sst.Secret("PG_REPORTING_DB_NAME")
    const pgUser = new sst.Secret("PG_USER")

    const vpcConfig = {
      privateSubnets: ["subnet-0e48b4a313f737af1"],
      securityGroups: ["sg-0a25fef8c6fcf9c21"],
    };

    const server = new sst.aws.OpenControl("MyServer", {
      server: {
        vpc: $app.stage === "production" ? vpcConfig : undefined,
        handler: "src/index.handler",
        link: [
          anthropicKey,
          pgDbHost,
          pgDbPassword,
          pgDbPort,
          pgDbReadHost,
          pgDbUser,
          pgEveryDbName,
          pgHost,
          pgPort,
          pgPwd,
          pgReportingDbName,
          pgUser
        ],
        policies: [
          "arn:aws:iam::aws:policy/AdministratorAccess",
          "arn:aws:iam::aws:policy/AWSBillingReadOnlyAccess"
        ]
      },
    })

    return {
      OpenControlUrl: server.url,
      OpenControlPassword: server.password,
    }
  },
});
