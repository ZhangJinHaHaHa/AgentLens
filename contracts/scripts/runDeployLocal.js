const { deployLocalRegistry } = require("./deployLocal");

async function main() {
  const deployment = await deployLocalRegistry();
  process.stdout.write(`${JSON.stringify(deployment, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
