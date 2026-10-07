import { Link } from 'react-router';
import { useAuth } from '../AuthContext.js';
import { useAuthForm } from '../useAuthForm.js';
import { AuthLayout } from '../components/AuthLayout.jsx';
import { TextField } from '../../../components/ui/TextField.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const form = useAuthForm({ email: '', password: '' }, login);

  return (
    <AuthLayout
      title="Log in"
      footer={
        <>
          New to StudyMate?{' '}
          <Link to="/register" className="font-semibold text-ink underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={form.submit} noValidate className="flex flex-col gap-5">
        <Alert>{form.formError}</Alert>
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
          autoComplete="current-password"
          value={form.values.password}
          onChange={form.update}
          error={form.fieldErrors.password}
        />
        <Button type="submit" loading={form.isPending}>
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}
