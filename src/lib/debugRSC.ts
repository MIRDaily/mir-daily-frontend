let debugSequence = 0

function nextDebugLabel(prefix: string): string {
  debugSequence += 1
  return `${prefix}_${debugSequence}`
}

export function debugRender(name: string) {
  const label = nextDebugLabel(`${name}_time`)
  console.count(`${name}_render`)
  console.time(label)

  let ended = false
  const end = () => {
    if (ended) return
    ended = true
    console.timeEnd(label)
  }

  queueMicrotask(end)
  return end
}

export async function debugFetch<T>(name: string, run: () => Promise<T>): Promise<T> {
  const label = nextDebugLabel(`${name}_fetch`)
  console.time(label)
  try {
    return await run()
  } finally {
    console.timeEnd(label)
  }
}
