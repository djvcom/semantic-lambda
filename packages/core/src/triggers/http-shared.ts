export function normaliseHeaders(
  headers: Record<string, string | undefined> | null,
): Record<string, string> {
  if (!headers) return {}
  const normalised: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      normalised[key.toLowerCase()] = value
    }
  }
  return normalised
}

export function parseHostHeader(host: string): { address: string; port?: number } {
  const colonIndex = host.lastIndexOf(':')
  if (colonIndex === -1) {
    return { address: host }
  }

  const possiblePort = host.slice(colonIndex + 1)
  const port = Number.parseInt(possiblePort, 10)

  if (Number.isNaN(port)) {
    return { address: host }
  }

  return { address: host.slice(0, colonIndex), port }
}
