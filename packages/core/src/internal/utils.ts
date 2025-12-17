/**
 * Converts an unknown thrown value to an Error instance.
 * Preserves Error instances, extracts message from objects with a message property,
 * and converts other values to strings.
 */
export function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value
  }
  if (typeof value === 'object' && value !== null && 'message' in value) {
    const error = new Error(String((value as { message: unknown }).message))
    if ('name' in value && typeof (value as { name: unknown }).name === 'string') {
      error.name = (value as { name: string }).name
    }
    return error
  }
  return new Error(String(value))
}
