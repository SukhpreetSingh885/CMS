import { UseFormSetError, FieldValues, Path } from 'react-hook-form';
import { ApiError } from './apiError';
import { ApiFieldError } from '../types/api';

/**
 * Extracts a map of { fieldName: errorMessage } from any error object
 */
export function extractFieldErrors(error: unknown): {
  fieldErrors: Record<string, string>;
  firstField?: string;
} {
  const fieldErrors: Record<string, string> = {};
  let errorsList: ApiFieldError[] = [];

  if (error instanceof ApiError) {
    errorsList = error.errors;
  } else if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as any).response?.data?.errors === 'object'
  ) {
    errorsList = (error as any).response.data.errors;
  } else if (typeof error === 'object' && error !== null && 'errors' in error) {
    errorsList = (error as any).errors;
  }

  if (Array.isArray(errorsList)) {
    for (const err of errorsList) {
      if (err.field && err.message) {
        fieldErrors[err.field] = err.message;
      }
    }
  }

  const firstField = Object.keys(fieldErrors)[0];
  return { fieldErrors, firstField };
}

/**
 * Applies backend validation errors directly to React Hook Form
 */
export function applyServerErrorsToForm<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>
): string | undefined {
  const { fieldErrors, firstField } = extractFieldErrors(error);

  for (const [field, message] of Object.entries(fieldErrors)) {
    // Map notation if needed (e.g. services[0].serviceId -> services.0.serviceId)
    const formattedField = field.replace(/\[(\d+)\]/g, '.$1') as Path<T>;
    setError(formattedField, {
      type: 'server',
      message,
    });
  }

  return firstField;
}

/**
 * Given the first invalid field, determine which step in a wizard contains it
 */
export function getWizardStepForField(
  fieldName: string | undefined,
  stepFieldMap: Record<number, string[]>
): number | undefined {
  if (!fieldName) return undefined;

  for (const [stepStr, fields] of Object.entries(stepFieldMap)) {
    const stepNum = Number(stepStr);
    if (fields.some((f) => fieldName === f || fieldName.startsWith(`${f}.`) || fieldName.startsWith(`${f}[`))) {
      return stepNum;
    }
  }

  return undefined;
}

