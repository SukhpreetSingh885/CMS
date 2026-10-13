import { z } from 'zod';

export const packageDeliverableSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1, 'Deliverable name is required'),
    deliverableType: z.enum(['QUANTITY', 'FEATURE', 'MILESTONE']).default('QUANTITY'),
    quantity: z.number().int().optional().nullable().default(1),
    unit: z.string().optional().nullable().default('Units'),
    targetPeriod: z
      .enum([
        'ONE_TIME',
        'WEEKLY',
        'MONTHLY',
        'QUARTERLY',
        'YEARLY',
        'CAMPAIGN_SCOPE',
        'MILESTONE_BASED',
      ])
      .default('MONTHLY'),
    isIncluded: z.boolean().optional().default(true),
    description: z.string().optional().nullable(),
    sortOrder: z.number().int().optional().default(0),
  })
  .superRefine((val, ctx) => {
    if (val.deliverableType === 'QUANTITY' || val.deliverableType === undefined) {
      if (val.quantity !== undefined && val.quantity !== null && val.quantity <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Quantity must be at least 1 for quantitative deliverables',
          path: ['quantity'],
        });
      }
    }
  });

export const packageServiceInclusionSchema = z.object({
  serviceId: z.string().min(1, 'Service selection is required'),
  monthlyTarget: z.number().int().min(0).optional(),
  defaultWeight: z.number().min(0.1).optional().default(1.0),
  deliverables: z.string().optional().nullable(),
  deliverablesList: z.array(packageDeliverableSchema).optional().default([]),
});

export const createPackageSchema = z
  .object({
    name: z.string().min(2, 'Package name must be at least 2 characters'),
    packageType: z.enum(['SINGLE_SERVICE', 'COMBINED_BUSINESS']).default('SINGLE_SERVICE'),
    description: z.string().optional().nullable(),
    basePrice: z.number().nonnegative('Package price must be 0 or positive'),
    billingCycle: z.enum(['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'ANNUALLY']).default('MONTHLY'),
    setupFee: z.number().nonnegative().optional().default(0),
    features: z.array(z.string()).optional().default([]),
    services: z.array(packageServiceInclusionSchema).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (data.services && data.services.length > 0) {
      // 1. Prevent duplicate service selections
      const serviceIds = data.services.map((s) => s.serviceId);
      const uniqueIds = new Set(serviceIds);
      if (uniqueIds.size !== serviceIds.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duplicate service selections are not allowed. Each service can only be added once.',
          path: ['services'],
        });
      }

      // 2. Validate Single Service Package vs Combined Business Package
      if (data.packageType === 'SINGLE_SERVICE' && data.services.length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A Single Service Package must contain exactly one selected service.',
          path: ['services'],
        });
      }

      if (data.packageType === 'COMBINED_BUSINESS' && data.services.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A Business / Combined Package must contain at least two services.',
          path: ['services'],
        });
      }
    }
  });

export const updatePackageSchema = z
  .object({
    name: z.string().min(2, 'Package name must be at least 2 characters').optional(),
    packageType: z.enum(['SINGLE_SERVICE', 'COMBINED_BUSINESS']).optional(),
    description: z.string().optional().nullable(),
    basePrice: z.number().nonnegative('Package price must be 0 or positive').optional(),
    billingCycle: z.enum(['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'ANNUALLY']).optional(),
    setupFee: z.number().nonnegative().optional(),
    features: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
    isArchived: z.boolean().optional(),
    services: z.array(packageServiceInclusionSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.services) {
      const serviceIds = data.services.map((s) => s.serviceId);
      const uniqueIds = new Set(serviceIds);
      if (uniqueIds.size !== serviceIds.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duplicate service selections are not allowed.',
          path: ['services'],
        });
      }

      if (data.packageType === 'SINGLE_SERVICE' && data.services.length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A Single Service Package must contain exactly one selected service.',
          path: ['services'],
        });
      }

      if (data.packageType === 'COMBINED_BUSINESS' && data.services.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A Business / Combined Package must contain at least two services.',
          path: ['services'],
        });
      }
    }
  });

export const createServiceSchema = z.object({
  name: z.string().min(2, 'Service name is required'),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  defaultMonthlyTarget: z.number().int().optional().default(10),
  icon: z.string().optional().nullable(),
});

export const updateServiceSchema = z.object({
  name: z.string().min(2, 'Service name is required').optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  defaultMonthlyTarget: z.number().int().optional(),
  icon: z.string().optional().nullable(),
});
