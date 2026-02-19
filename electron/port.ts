import detectPort from "detect-port";

const DEFAULT_PORT = 3947;

export async function findAvailablePort(): Promise<number> {
  const port = await detectPort(DEFAULT_PORT);
  return port;
}
