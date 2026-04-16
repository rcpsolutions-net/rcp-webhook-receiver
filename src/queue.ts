export interface QueuedWebhookEvent {
  provider: string;
  headers: Record<string, unknown>;
  body: unknown;
  receivedAt: string;
}

const queue: QueuedWebhookEvent[] = [];

export async function enqueue(event: QueuedWebhookEvent): Promise<void> {
    return new Promise((resolve) => {
      queue.push(event);
      resolve();
    });  
}

export function drain(): QueuedWebhookEvent[] {
  return queue.splice(0, queue.length);
}

export function depth(): number {
  return queue.length;
}
