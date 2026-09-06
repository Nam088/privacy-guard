export interface DescribedValue {
  type: string;
  byteLength: number;
}

export interface ObservedEvent {
  seq: number;
  at: number;
  kind: string;
  target: string;
  frameUrl?: string;
  value?: DescribedValue;
  payload?: unknown;
}

export type CaptureList = ObservedEvent[];

export const describedValueSchema = {
  parse(val: unknown): DescribedValue {
    const res = this.safeParse(val);
    if (!res.success) {
      throw res.error;
    }
    return res.data;
  },
  safeParse(val: unknown): { success: true; data: DescribedValue } | { success: false; error: Error } {
    if (typeof val !== 'object' || val === null) {
      return { success: false, error: new Error('DescribedValue must be an object') };
    }
    const c = val as Record<string, unknown>;
    if (typeof c.type !== 'string' || typeof c.byteLength !== 'number') {
      return { success: false, error: new Error('Invalid DescribedValue') };
    }
    return { success: true, data: { type: c.type, byteLength: c.byteLength } };
  },
};

export const observedEventSchema = {
  parse(val: unknown): ObservedEvent {
    const res = this.safeParse(val);
    if (!res.success) {
      throw res.error;
    }
    return res.data;
  },
  safeParse(val: unknown): { success: true; data: ObservedEvent } | { success: false; error: Error } {
    if (typeof val !== 'object' || val === null) {
      return { success: false, error: new Error('ObservedEvent must be an object') };
    }
    const c = val as Record<string, unknown>;
    if (
      typeof c.seq !== 'number' ||
      typeof c.at !== 'number' ||
      typeof c.kind !== 'string' ||
      typeof c.target !== 'string'
    ) {
      return { success: false, error: new Error('Invalid ObservedEvent required fields') };
    }
    if (c.frameUrl !== undefined && typeof c.frameUrl !== 'string') {
      return { success: false, error: new Error('frameUrl must be a string') };
    }
    let value: DescribedValue | undefined;
    if (c.value !== undefined) {
      const vRes = describedValueSchema.safeParse(c.value);
      if (!vRes.success) {
        return vRes;
      }
      value = vRes.data;
    }
    return {
      success: true,
      data: {
        seq: c.seq,
        at: c.at,
        kind: c.kind,
        target: c.target,
        frameUrl: c.frameUrl,
        value,
        payload: c.payload,
      },
    };
  },
};

export const captureListSchema = {
  parse(val: unknown): ObservedEvent[] {
    const res = this.safeParse(val);
    if (!res.success) {
      throw res.error;
    }
    return res.data;
  },
  safeParse(val: unknown): { success: true; data: ObservedEvent[] } | { success: false; error: Error } {
    if (!Array.isArray(val)) {
      return { success: false, error: new Error('CaptureList must be an array') };
    }
    const list: ObservedEvent[] = [];
    for (const item of val) {
      const itemRes = observedEventSchema.safeParse(item);
      if (!itemRes.success) {
        return itemRes;
      }
      list.push(itemRes.data);
    }
    return { success: true, data: list };
  },
};
