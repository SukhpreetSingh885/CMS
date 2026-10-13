import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      const user = await login(data);
      toast.success(`Welcome back, ${user.fullName}!`);
      if (user.role === 'ADMIN') {
        navigate('/admin/dashboard');
      } else {
        navigate('/employee/dashboard');
      }
    } catch {
      // Error handled by Axios interceptor
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-bold text-slate-900">Sign in to your account</h3>
        <p className="text-xs text-slate-500 mt-1">
          Enter your authorized credentials to access your Viralstan CMS workspace
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Input
            label="Work Email Address"
            type="email"
            placeholder="name@viralstan.com"
            error={errors.email?.message}
            {...register('email')}
          />
        </div>

        <div>
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register('password')}
          />
        </div>

        <div className="flex items-center justify-between text-xs pt-1">
          <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            Remember me
          </label>
          <Link
            to="/forgot-password"
            className="text-purple-600 hover:text-purple-700 font-medium"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="w-full mt-2" isLoading={isLoading}>
          Sign In
        </Button>
      </form>
    </div>
  );
};
