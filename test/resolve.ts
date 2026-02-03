import { fileURLToPath } from 'url'

export function resolve(specifier: string) {
  return fileURLToPath(import.meta.resolve(specifier))
}
