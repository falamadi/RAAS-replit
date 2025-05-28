import { useState, useCallback, useEffect } from 'react';
import { z } from 'zod';
import { formatValidationErrors } from '@/lib/validation';

interface ValidationState<T> {
  data: T;
  errors: Record<string, string>;
  isValid: boolean;
  isValidating: boolean;
  touched: Record<string, boolean>;
}

interface UseValidationOptions {
  mode?: 'onChange' | 'onBlur' | 'onSubmit';
  revalidateOn?: 'onChange' | 'onBlur';
  debounceMs?: number;
}

export function useValidation<T extends Record<string, any>>(
  schema: z.ZodSchema<T>,
  initialData: T,
  options: UseValidationOptions = {}
) {
  const {
    mode = 'onChange',
    revalidateOn = 'onChange',
    debounceMs = 300
  } = options;

  const [state, setState] = useState<ValidationState<T>>({
    data: initialData,
    errors: {},
    isValid: true,
    isValidating: false,
    touched: {}
  });

  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Validate a single field
  const validateField = useCallback(
    async (field: keyof T, value: any): Promise<string | null> => {
      try {
        // Create a partial schema for the field
        const fieldSchema = schema.shape[field as string];
        if (!fieldSchema) return null;

        await fieldSchema.parseAsync(value);
        return null;
      } catch (error) {
        if (error instanceof z.ZodError) {
          return error.errors[0]?.message || 'Invalid value';
        }
        return 'Validation error';
      }
    },
    [schema]
  );

  // Validate all data
  const validateAll = useCallback(
    async (data: T): Promise<Record<string, string>> => {
      try {
        await schema.parseAsync(data);
        return {};
      } catch (error) {
        if (error instanceof z.ZodError) {
          return formatValidationErrors(error.errors);
        }
        return { _error: 'Validation failed' };
      }
    },
    [schema]
  );

  // Handle field change
  const handleChange = useCallback(
    async (field: keyof T, value: any) => {
      const newData = { ...state.data, [field]: value };
      
      setState(prev => ({
        ...prev,
        data: newData,
        touched: { ...prev.touched, [field]: true }
      }));

      // Clear existing debounce timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // Debounced validation
      if (mode === 'onChange' || (state.touched[field] && revalidateOn === 'onChange')) {
        const timer = setTimeout(async () => {
          setState(prev => ({ ...prev, isValidating: true }));
          
          const fieldError = await validateField(field, value);
          
          setState(prev => ({
            ...prev,
            errors: {
              ...prev.errors,
              [field]: fieldError || ''
            },
            isValidating: false,
            isValid: !fieldError && Object.values(prev.errors).every(e => !e)
          }));
        }, debounceMs);
        
        setDebounceTimer(timer);
      }
    },
    [state.data, state.touched, mode, revalidateOn, debounceMs, validateField, debounceTimer]
  );

  // Handle field blur
  const handleBlur = useCallback(
    async (field: keyof T) => {
      setState(prev => ({
        ...prev,
        touched: { ...prev.touched, [field]: true }
      }));

      if (mode === 'onBlur' || revalidateOn === 'onBlur') {
        setState(prev => ({ ...prev, isValidating: true }));
        
        const fieldError = await validateField(field, state.data[field]);
        
        setState(prev => ({
          ...prev,
          errors: {
            ...prev.errors,
            [field]: fieldError || ''
          },
          isValidating: false,
          isValid: !fieldError && Object.values(prev.errors).every(e => !e)
        }));
      }
    },
    [mode, revalidateOn, state.data, validateField]
  );

  // Submit handler
  const handleSubmit = useCallback(
    async (onValid: (data: T) => void | Promise<void>) => {
      setState(prev => ({ ...prev, isValidating: true }));
      
      const errors = await validateAll(state.data);
      const isValid = Object.keys(errors).length === 0;
      
      setState(prev => ({
        ...prev,
        errors,
        isValid,
        isValidating: false,
        touched: Object.keys(prev.data).reduce((acc, key) => ({
          ...acc,
          [key]: true
        }), {})
      }));

      if (isValid) {
        await onValid(state.data);
      }
    },
    [state.data, validateAll]
  );

  // Reset form
  const reset = useCallback(
    (data?: Partial<T>) => {
      setState({
        data: data ? { ...initialData, ...data } : initialData,
        errors: {},
        isValid: true,
        isValidating: false,
        touched: {}
      });
    },
    [initialData]
  );

  // Set field error manually
  const setFieldError = useCallback(
    (field: keyof T, error: string) => {
      setState(prev => ({
        ...prev,
        errors: { ...prev.errors, [field]: error }
      }));
    },
    []
  );

  // Set multiple errors
  const setErrors = useCallback(
    (errors: Record<string, string>) => {
      setState(prev => ({
        ...prev,
        errors
      }));
    },
    []
  );

  // Get field props
  const getFieldProps = useCallback(
    (field: keyof T) => ({
      value: state.data[field],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const value = e.target.type === 'checkbox' 
          ? (e.target as HTMLInputElement).checked 
          : e.target.value;
        handleChange(field, value);
      },
      onBlur: () => handleBlur(field),
      error: state.touched[field] ? state.errors[field as string] : undefined,
      name: field as string
    }),
    [state.data, state.errors, state.touched, handleChange, handleBlur]
  );

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  return {
    data: state.data,
    errors: state.errors,
    isValid: state.isValid,
    isValidating: state.isValidating,
    touched: state.touched,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setFieldError,
    setErrors,
    getFieldProps,
    validateField,
    validateAll
  };
}

// Simplified hook for forms with react-hook-form
export function useZodForm<T extends Record<string, any>>(
  schema: z.ZodSchema<T>,
  defaultValues?: Partial<T>
) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback(
    async (data: T): Promise<boolean> => {
      try {
        await schema.parseAsync(data);
        setErrors({});
        return true;
      } catch (error) {
        if (error instanceof z.ZodError) {
          setErrors(formatValidationErrors(error.errors));
        }
        return false;
      }
    },
    [schema]
  );

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  return {
    errors,
    validate,
    clearErrors,
    resolver: async (data: T) => {
      try {
        const validated = await schema.parseAsync(data);
        return { values: validated, errors: {} };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return {
            values: {},
            errors: formatValidationErrors(error.errors)
          };
        }
        return { values: {}, errors: { _error: 'Validation failed' } };
      }
    }
  };
}