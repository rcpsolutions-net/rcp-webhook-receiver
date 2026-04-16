import { Schema, model, Document } from 'mongoose';

export interface IIncomingWebhook extends Document {
  provider: string;
  eventName: string;
  payload: Record<string, any>;
  processed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const incomingWebhookSchema = new Schema<IIncomingWebhook>({
  provider: {
    type: String,
    default: 'system',
    required: false,
  },

  eventName: {
    type: String,
    default: null,
    required: true,
  },

  payload: {
    type: Object, // JSON.parsed(raw JSON from the provider)
    default: null,
    required: true,
  },

  processed: {
    type: Boolean,
    default: false,
    required: false,
  },
}, {
  collection: 'incoming-webhooks',
  timestamps: true,
  versionKey: false,
  autoIndex: true, 
});

export const incomingWebhooks = model<IIncomingWebhook>('incoming-webhooks', incomingWebhookSchema);