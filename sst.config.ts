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

    const server = new sst.aws.OpenControl("MyServer", {
      server: {
        handler: "src/index.handler",
        link: [anthropicKey],
        policies: $dev
          ? ["arn:aws:iam::aws:policy/AdministratorAccess"]
          : ["arn:aws:iam::aws:policy/ReadOnlyAccess"],
      },
    })

    return {
      OpenControlUrl: server.url,
      OpenControlPassword: server.password,
    }
  },
});
