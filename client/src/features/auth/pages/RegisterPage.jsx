import { Link } from 'react-router';
import { useAuth } from '../AuthContext.js';
import { useAuthForm } from '../useAuthForm.js';
import { AuthLayout } from '../components/AuthLayout.jsx';
import { TextField } from '../../../components/ui/TextField.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const form = useAuthForm({ name: '', email: '', password: '' }, register);

  return (
    <AuthLayout
      title="Create your account"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-ink underline underline-offset-4">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={form.submit} noValidate className="flex flex-col gap-5">
        <Alert>{form.formError}</Alert>
        <TextField
          label="Name"
          name="name"
          autoComplete="name"
          value={form.values.name}
          onChange={form.update}
          error={form.fieldErrors.name}
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={form.values.email}
          onChange={form.update}
          error={form.fieldErrors.email}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters, with a letter and a number."
          value={form.values.password}
          onChange={form.update}
          error={form.fieldErrors.password}
        />
        <Button type="submit" loading={form.isPending}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
