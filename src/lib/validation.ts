import { z } from 'zod'

const MAX_COMPANY_NAME = 200
const MAX_USER_CONTEXT = 2000
const MAX_SEARCH_QUERY = 100

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

export const signupSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Au moins 8 caractères'),
  fullName: z.string().min(1, 'Nom requis').max(200, 'Nom trop long'),
})

export const companySearchSchema = z.object({
  query: z
    .string()
    .trim()
    .min(2, 'Au moins 2 caractères')
    .max(MAX_SEARCH_QUERY, 'Recherche trop longue'),
})

export const analyzeAccountSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(1, 'Nom d’entreprise requis')
    .max(MAX_COMPANY_NAME, 'Nom trop long'),
  userContext: z
    .string()
    .max(MAX_USER_CONTEXT, 'Contexte trop long')
    .optional()
    .nullable(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type CompanySearchInput = z.infer<typeof companySearchSchema>
export type AnalyzeAccountInput = z.infer<typeof analyzeAccountSchema>
