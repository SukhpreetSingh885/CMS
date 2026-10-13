import { z } from 'zod';

const optionalString = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
  z.string().nullable().optional()
);

const optionalNumber = (defaultValue = 0) =>
  z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? defaultValue : Number(val)),
    z.number().nonnegative().default(defaultValue)
  );

export const createClientSchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  contactPerson: z.string().min(2, 'Contact person must be at least 2 characters'),
  contactDesignation: optionalString,
  mobileNumber: z.string().min(8, 'Please enter a valid contact mobile number'),
  whatsAppNumber: optionalString,
  email: z.string().email('Please enter a valid email address'),
  website: optionalString,
  instagram: optionalString,
  facebook: optionalString,
  linkedIn: optionalString,
  address: optionalString,
  city: optionalString,
  industry: optionalString,
  leadSource: optionalString,
  onboardingDate: optionalString,
  contractStartDate: z.string().min(1, 'Contract start date is required'),
  contractEndDate: z.string().min(1, 'Contract end date is required'),
  renewalDate: z.string().min(1, 'Renewal date is required'),
  assignedAdminId: optionalString,
  packageId: optionalString,
  packagePricing: optionalNumber(0),
  billingCycle: z.enum(['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'ANNUALLY']).default('MONTHLY'),
  clientPriority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  clientGoals: optionalString,
  status: z
    .enum(['LEAD', 'WON', 'ONBOARDING', 'ACTIVE', 'RENEWAL_DUE', 'RENEWED', 'PAUSED', 'COMPLETED', 'CHURNED'])
    .default('ONBOARDING'),
  assignedEmployeeIds: z.array(z.string()).optional().default([]),
  services: z
    .array(
      z.object({
        serviceId: z.string().min(1, 'Service ID is required'),
        assignedEmployeeId: optionalString,
        assignedEmployeeIds: z.array(z.string()).optional().default([]),
        monthlyTarget: z.preprocess(
          (val) => (val === '' || val === undefined || val === null ? 10 : Number(val)),
          z.number().int().min(1, 'Target must be at least 1').default(10)
        ),
        serviceWeight: z.preprocess(
          (val) => (val === '' || val === undefined || val === null ? 1.0 : Number(val)),
          z.number().min(0.1, 'Weight must be at least 0.1').default(1.0)
        ),
        notes: optionalString,
        deliverables: optionalString,
        deliverablesConfig: z.any().optional(),
      })
    )
    .optional()
    .default([]),
  contractSnapshot: z.any().optional(),
  generateFirstInvoice: z.boolean().default(true),
});

export const updateClientSchema = createClientSchema.partial();

export const updateClientServiceTeamSchema = z.object({
  employeeIds: z.array(z.string()).default([]),
});

export const deleteClientPermanentSchema = z.object({
  confirmation: z.string().min(1, 'Confirmation is required'),
});
