export interface SegmentPolicy {
  minChars: number;
  targetChars: number;
  maxChars: number;
  hardPunctuation: RegExp;
  softPunctuation: RegExp;
}

export interface StreamingTextSegmenter {
  push: (chunk: string) => string[];
  flush: () => string[];
}

export const DEFAULT_SEGMENT_POLICY: SegmentPolicy = {
  minChars: 10,
  targetChars: 28,
  maxChars: 48,
  hardPunctuation: /[。！？!?；;\n]/,
  softPunctuation: /[，,、：:]/,
};

function hasMatch(pattern: RegExp, value: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(value);
}

function findBoundary(buffer: string, policy: SegmentPolicy): number {
  let softBoundary = -1;

  for (let i = 0; i < buffer.length; i += 1) {
    const char = buffer[i];
    const end = i + 1;

    if (hasMatch(policy.hardPunctuation, char) && end >= policy.minChars) return end;
    if (hasMatch(policy.softPunctuation, char) && end >= policy.targetChars) softBoundary = end;
  }

  if (softBoundary >= policy.targetChars) return softBoundary;
  if (buffer.length >= policy.maxChars) return policy.maxChars;
  return -1;
}

export function createStreamingTextSegmenter(overrides: Partial<SegmentPolicy> = {}): StreamingTextSegmenter {
  const policy = { ...DEFAULT_SEGMENT_POLICY, ...overrides };
  let buffer = "";

  function drain(): string[] {
    const segments: string[] = [];

    while (buffer.trim().length > 0) {
      const boundary = findBoundary(buffer, policy);
      if (boundary < 0) break;

      const segment = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary).trimStart();
      if (segment.length > 0) segments.push(segment);
    }

    return segments;
  }

  return {
    push(chunk: string) {
      if (chunk.trim().length === 0) return [];
      buffer += chunk;
      return drain();
    },
    flush() {
      const drained = drain();
      const tail = buffer.trim();
      buffer = "";
      return tail.length > 0 ? [...drained, tail] : drained;
    },
  };
}
