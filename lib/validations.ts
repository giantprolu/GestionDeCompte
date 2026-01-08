import { z } from 'zod'

export const accountSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  type: z.enum(['ponctuel', 'obligatoire']),
  initialBalance: z.number(), // Les soldes négatifs sont maintenant autorisés
})

export const expenseSchema = z.object({
  amount: z.number().positive('Le montant doit être positif'),
  category: z.string().min(1, 'La catégorie est requise'),
  date: z.string().or(z.date()),
  accountId: z.string().min(1, 'Le compte est requis'),
  note: z.string().optional(),
})

export type AccountFormData = z.infer<typeof accountSchema>
export type ExpenseFormData = z.infer<typeof expenseSchema>
