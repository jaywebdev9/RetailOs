'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';

const schema = z.object({
  name: z.string().min(2, 'Business name is required'),
  businessType: z.enum([
    'GROCERY',
    'MINI_SUPERMARKET',
    'HARDWARE',
    'ELECTRONICS',
    'CLOTHING',
    'PHARMACY',
    'WHOLESALE',
    'GENERAL_RETAIL',
    'OTHER',
  ]),
  currency: z.string().default('TZS'),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const BUSINESS_TYPES = [
  { value: 'GROCERY', label: 'Grocery' },
  { value: 'MINI_SUPERMARKET', label: 'Mini supermarket' },
  { value: 'HARDWARE', label: 'Hardware' },
  { value: 'ELECTRONICS', label: 'Electronics' },
  { value: 'CLOTHING', label: 'Clothing' },
  { value: 'PHARMACY', label: 'Pharmacy' },
  { value: 'WHOLESALE', label: 'Wholesale' },
  { value: 'GENERAL_RETAIL', label: 'General retail' },
  { value: 'OTHER', label: 'Other' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'TZS', businessType: 'GROCERY' },
  });

  const onSubmit = async (data: FormData) => {
    setError(null);
    setLoading(true);
    try {
      await api.post('/businesses', data);
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to create business');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">Set up your business</h1>
          <p className="mt-1 text-sm text-slate-500">One shop · One location</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm"
        >
          {error && (
            <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Business name
            </label>
            <input
              {...register('name')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              placeholder="Mama Amina Shop"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Business type
            </label>
            <select
              {...register('businessType')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {BUSINESS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
            <select
              {...register('currency')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              <option value="TZS">TZS – Tanzanian Shilling</option>
              <option value="KES">KES – Kenyan Shilling</option>
              <option value="UGX">UGX – Ugandan Shilling</option>
              <option value="USD">USD – US Dollar</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone (optional)</label>
            <input
              {...register('phone')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              placeholder="+255 7XX XXX XXX"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address (optional)</label>
            <input
              {...register('address')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50 transition"
          >
            {loading ? 'Creating…' : 'Create business & continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
