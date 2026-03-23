import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function* streamTextChunks(
  text: string,
  chunkSize = 8,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  for (let i = 0; i < text.length; i += chunkSize) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    await sleep(25)
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    yield text.slice(i, i + chunkSize)
  }
}
