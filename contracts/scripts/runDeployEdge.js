const { deployEdgeRegistry, readEdgeDeploymentConfig } = require("./deployEdge");

async function main() {
  const deployment = await deployEdgeRegistry(readEdgeDeploymentConfig(process.env));
  process.stdout.write(`${JSON.stringify(deployment, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
