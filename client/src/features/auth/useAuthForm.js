import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { getErrorMessage, getFieldErrors } from '../../lib/errors.js';

export function useAuthForm(initialValues, action) {
  const [values, setValues] = useState(initialValues);
  const mutation = useMutation({ mutationFn: action });
  const fieldErrors = getFieldErrors(mutation.error);
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  return {
    values,
    fieldErrors,
    formError: mutation.isError && !hasFieldErrors ? getErrorMessage(mutation.error) : null,
    isPending: mutation.isPending,
    update: (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value })),
    submit: (e) => {
      e.preventDefault();
      mutation.mutate(values);
    },
  };
}
