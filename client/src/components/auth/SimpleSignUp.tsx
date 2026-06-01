import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff } from 'lucide-react';

interface SimpleSignUpProps {
  onSuccess?: () => void;
}

const SimpleSignUp: React.FC<SimpleSignUpProps> = ({ onSuccess }) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    passwordConfirm: '',
    role: 'user'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.username || !form.email || !form.password) {
      toast({ title: t('signUpFailed'), description: t('pleaseFillAllRequired'), variant: 'destructive' });
      return;
    }
    if (form.password !== form.passwordConfirm) {
      toast({ title: t('signUpFailed'), description: t('passwordsDontMatch'), variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      const { passwordConfirm, ...payload } = form;
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Signup failed'}));
        throw new Error(err.message || 'Signup failed');
      }
      const user = await res.json();

      if (user.pendingApproval) {
        toast({ title: t('accountCreated'), description: user.message || t('coachAccountPendingApproval') });
        setTimeout(() => { window.location.href = '/auth'; }, 1200);
        return;
      }

      toast({ title: t('accountCreated'), description: t('welcomeToXTraining') });
      localStorage.setItem('currentUser', JSON.stringify(user));
      setTimeout(() => { window.location.href = '/dashboard'; }, 800);
      onSuccess && onSuccess();
    } catch (err: any) {
      toast({ title: t('signUpFailed'), description: err.message || 'Error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Input name="firstName" placeholder={t('firstName')} value={form.firstName} onChange={handleChange} />
        <Input name="lastName" placeholder={t('lastName')} value={form.lastName} onChange={handleChange} />
      </div>
      <Input name="username" placeholder={t('username')} value={form.username} onChange={handleChange} />
      <Input name="email" type="email" placeholder={t('email')} value={form.email} onChange={handleChange} />
      <div className="relative">
        <Input 
          name="password" 
          type={showPassword ? "text" : "password"}
          placeholder={t('password')} 
          value={form.password} 
          onChange={handleChange}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
      <div className="relative">
        <Input 
          name="passwordConfirm" 
          type={showPasswordConfirm ? "text" : "password"}
          placeholder={t('confirmPassword') || 'Confirm Password'} 
          value={form.passwordConfirm} 
          onChange={handleChange}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
        >
          {showPasswordConfirm ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
      <select name="role" value={form.role} onChange={handleChange} className="w-full border rounded px-3 py-2 text-sm bg-white">
        <option value="user">{t('user') || 'User'}</option>
        <option value="coach">{t('coach') || 'Coach'}</option>
      </select>
      <Button type="submit" className="w-full" disabled={loading}>{loading ? t('loading') : t('signup')}</Button>
    </form>
  );
};

export default SimpleSignUp;
