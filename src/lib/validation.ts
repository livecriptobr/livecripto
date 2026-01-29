import { z } from 'zod'

export const donateInitSchema = z.object({
  username: z.string().min(1).max(30),
  amountCents: z.number().int().min(100).max(1000000),
  donorName: z.string().min(1).max(50),
  message: z.string().min(1).max(400),
  method: z.enum(['pix', 'card', 'lightning']),
  voiceMessageUrl: z.string().url().optional().nullable(),
  mediaUrl: z.string().url().optional().nullable(),
  mediaType: z.enum(['gif', 'image', 'video']).optional().nullable(),
  goalId: z.string().optional().nullable(),
  pollOptionId: z.string().optional().nullable(),
})

export type DonateInitInput = z.infer<typeof donateInitSchema>
