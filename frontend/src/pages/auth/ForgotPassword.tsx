import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ArrowLeft, CheckCircle } from 'lucide-react';

const schema = z.object({
  email: z.string().email('Please enter a valid work email'),
});

export const ForgotPassword: React.FC = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ email: string }>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
    }, 800);
  };

  return (
    <div>
      <div className="mb-6">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to login
        </Link>
        <h3 className="text-lg font-bold text-slate-900">Reset your password</h3>
        <p className="text-xs text-slate-500 mt-1">
          Enter your registered work email and we will send you password reset instructions.
        </p>
      </div>

      {isSubmitted ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
          <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-emerald-900">Reset instructions sent!</h4>
          <p className="text-xs text-emerald-700 mt-1">
            If an active account exists for that email, password recovery steps have been delivered.
          </p>
          <Link to="/login" className="inline-block mt-4">
            <Button size="sm" variant="outline">
              Return to Login
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Work Email Address"
            type="email"
            placeholder="name@viralstan.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <Button type="submit" className="w-full mt-2" isLoading={isLoading}>
            Send Reset Instructions
          </Button>
        </form>
      )}
    </div>
  );
};

