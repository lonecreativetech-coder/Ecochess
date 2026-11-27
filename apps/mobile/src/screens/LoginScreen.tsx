import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiRequest, ApiClientError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme';

export function LoginScreen() {
  const { completeOtpLogin } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [busy, setBusy] = useState(false);

  const handleRequestOtp = async () => {
    if (!phone.trim()) {
      Alert.alert('Phone required', 'Enter your phone number to continue.');
      return;
    }
    setBusy(true);
    try {
      await apiRequest('/auth/otp/request', {
        method: 'POST',
        body: { phone: phone.trim() },
      });
      setStep('otp');
    } catch (err) {
      const msg =
        err instanceof ApiClientError ? err.message : 'Could not send OTP.';
      Alert.alert('Error', msg);
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (code.trim().length !== 6) {
      Alert.alert('Invalid code', 'Enter the 6-digit code.');
      return;
    }
    setBusy(true);
    try {
      const res = await apiRequest<{
        accessToken: string;
        refreshToken: string;
      }>('/auth/otp/verify', {
        method: 'POST',
        body: { phone: phone.trim(), code: code.trim() },
      });
      await completeOtpLogin(res.data.accessToken, res.data.refreshToken);
    } catch (err) {
      const msg =
        err instanceof ApiClientError ? err.message : 'Verification failed.';
      Alert.alert('Error', msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.brand}>EcoChess</Text>
        <Text style={styles.subtitle}>
          Learn chess. Collect waste. Level up your school.
        </Text>

        {step === 'phone' ? (
          <>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 08012345678"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              editable={!busy}
            />
            <Pressable
              style={[styles.button, busy && styles.buttonDisabled]}
              onPress={handleRequestOtp}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Send OTP Code</Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>Enter 6-Digit Code sent to {phone}</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={setCode}
              editable={!busy}
            />
            <Pressable
              style={[styles.button, busy && styles.buttonDisabled]}
              onPress={handleVerifyOtp}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify & Sign In</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.linkButton}
              onPress={() => {
                setCode('');
                setStep('phone');
              }}
            >
              <Text style={styles.linkText}>Use a different phone number</Text>
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primaryTint,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  brand: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: colors.background,
    marginBottom: 16,
  },
  codeInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 22,
    fontWeight: '700',
  },
  button: {
    backgroundColor: colors.primaryButton,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: colors.primaryButton,
    fontSize: 14,
    fontWeight: '600',
  },
});
