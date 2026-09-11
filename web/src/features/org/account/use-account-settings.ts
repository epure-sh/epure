import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../../ui/toast-provider";
import {
  apiErrorStatus,
  changePassword,
  deleteAccount,
  fetchAuthConfig,
  fetchMe,
  updateProfile,
  type AuthConfig,
  type MeResponse,
} from "../../../lib/api";

export function useAccountSettings() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [me, config] = await Promise.all([fetchMe(), fetchAuthConfig()]);
      setProfile(me);
      setAuthConfig(config);
    } catch {
      toast("Failed to load account settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
    navigate("/login", { replace: true });
  }

  async function saveDisplayName(displayName: string) {
    const trimmed = displayName.trim();
    await updateProfile({ display_name: trimmed.length > 0 ? trimmed : null });
    toast("Profile updated");
    await load();
  }

  async function savePassword(input: {
    hasPassword: boolean;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) {
    if (input.newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    if (input.newPassword !== input.confirmPassword) {
      throw new Error("New passwords do not match.");
    }
    if (input.hasPassword && !input.currentPassword) {
      throw new Error("Enter your current password.");
    }

    await changePassword({
      current_password: input.hasPassword ? input.currentPassword : undefined,
      new_password: input.newPassword,
    });
    toast(input.hasPassword ? "Password updated" : "Password set");
    await load();
  }

  async function removeAccount(input: {
    email: string;
    hasPassword: boolean;
    confirmEmail: string;
    password: string;
  }) {
    if (input.confirmEmail.trim().toLowerCase() !== input.email.toLowerCase()) {
      throw new Error("Email confirmation does not match your account.");
    }
    if (input.hasPassword && !input.password) {
      throw new Error("Enter your password to confirm deletion.");
    }

    try {
      await deleteAccount({
        confirm_email: input.confirmEmail.trim(),
        password: input.hasPassword ? input.password : undefined,
      });
      navigate("/login", { replace: true });
    } catch (error) {
      if (apiErrorStatus(error) === 409) {
        throw new Error("Transfer workspace ownership to another member before deleting your account.");
      }
      throw new Error("Could not delete account. Check your confirmation details.");
    }
  }

  return {
    profile,
    authConfig,
    loading,
    load,
    logout,
    saveDisplayName,
    savePassword,
    removeAccount,
  };
}

export type AccountSettingsContext = ReturnType<typeof useAccountSettings>;
