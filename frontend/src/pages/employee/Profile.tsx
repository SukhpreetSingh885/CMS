import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { formatDate } from '../../utils/formatters';
import { UserCheck, Lock, Shield } from 'lucide-react';
import { toast } from 'sonner';

export const Profile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const updated = await authService.updateProfile({ fullName, phone });
      updateUser(updated);
      toast.success('Profile details updated');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setIsSubmitting(true);
    try {
      await authService.updateProfile({ currentPassword, newPassword });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="My Profile & Settings"
        description="Manage your account profile details and security credentials."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-purple-100 text-purple-700 font-extrabold text-2xl flex items-center justify-center mx-auto mb-3 border-2 border-purple-200">
            {user?.fullName?.charAt(0).toUpperCase()}
          </div>
          <h3 className="text-base font-bold text-slate-900">{user?.fullName}</h3>
          <p className="text-xs text-purple-700 font-semibold mt-0.5">{user?.designation || user?.role}</p>
          <p className="text-xs text-slate-500 mt-0.5">{user?.department || 'Operations'}</p>

          <div className="mt-5 pt-4 border-t border-slate-100 text-left text-xs space-y-2 text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">Employee ID:</span>
              <span className="font-mono font-bold text-slate-900">{user?.employeeId || 'ADMIN'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Email:</span>
              <span className="text-slate-800">{user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Joined:</span>
              <span>{formatDate(user?.joiningDate || user?.createdAt)}</span>
            </div>
          </div>
        </Card>

        {/* Update Forms */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Details</CardTitle>
            </CardHeader>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <Input
                label="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
              <Input
                label="Phone Number"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Button type="submit" size="sm" isLoading={isSubmitting}>
                Save Profile Changes
              </Button>
            </form>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change Security Password</CardTitle>
            </CardHeader>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <Input
                label="Current Password"
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <Input
                label="New Password"
                type="password"
                placeholder="Minimum 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <Input
                label="Confirm New Password"
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <Button type="submit" size="sm" variant="outline" isLoading={isSubmitting}>
                Update Password
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

