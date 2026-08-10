export function isDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isFeatureEnabled(name: string): boolean {
  return process.env[name] === "true";
}

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not defined`);
  }
  return value;
}

export function getOptionalEnv(name: string): string | undefined {
  return process.env[name];
}