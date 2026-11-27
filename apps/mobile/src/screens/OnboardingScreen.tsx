import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiRequest, ApiClientError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme';

const AGE_BANDS = [
  { key: 'UNDER_10', label: 'Under 10' },
  { key: '10_13', label: '10–13' },
  { key: '14_17', label: '14–17' },
  { key: '18_PLUS', label: '18+' },
];

export function OnboardingScreen() {
  const { user, refreshProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [ageBand, setAgeBand] = useState(user?.ageBand ?? '10_13');
  const [joinCode, setJoinCode] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleFinish = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }
    if (!user?.cohortId && !joinCode.trim()) {
      Alert.alert(
        'Join code required',
        'Ask your facilitator for your school join code.',
      );
      return;
    }

    setBusy(true);
    try {
      await apiRequest('/users/me', {
        method: 'PATCH',
        body: { name: name.trim(), ageBand },
      });

      if (!user?.cohortId && joinCode.trim()) {
        await apiRequest('/auth/join-code', {
          method: 'POST',
          body: { code: joinCode.trim() },
        });
      }

      if (consentChecked && guardianName.trim()) {
        await apiRequest('/users/me/consent', {
          method: 'POST',
          body: {
            consentType: 'MEDIA_CAPTURE',
            guardianName: guardianName.trim(),
          },
        });
      }

      await refreshProfile();
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : 'Could not save onboarding info.';
      Alert.alert('Error', msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Welcome to EcoChess!</Text>
      <Text style={styles.subtitle}>Set up your student profile to begin.</Text>

      <Text style={styles.label}>Your Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Tolu Adeyemi"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Age Band</Text>
      <View style={styles.bandRow}>
        {AGE_BANDS.map((b) => (
          <Pressable
            key={b.key}
            style={[
              styles.bandPill,
              ageBand === b.key && styles.bandPillActive,
            ]}
            onPress={() => setAgeBand(b.key)}
          >
            <Text
              style={[
                styles.bandText,
                ageBand === b.key && styles.bandTextActive,
              ]}
            >
              {b.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {!user?.cohortId && (
        <>
          <Text style={styles.label}>School Join Code</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. FEST-2026"
            autoCapitalize="characters"
            value={joinCode}
            onChangeText={setJoinCode}
          />
        </>
      )}

      <View style={styles.consentBox}>
        <Text style={styles.consentTitle}>
          Parent / Guardian Camera Permission (Optional now)
        </Text>
        <Text style={styles.consentBody}>
          Required before taking photos of collected waste in EcoScan.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Parent or guardian full name"
          value={guardianName}
          onChangeText={setGuardianName}
        />
        <Pressable
          style={styles.checkRow}
          onPress={() => setConsentChecked((v) => !v)}
        >
          <View
            style={[styles.checkbox, consentChecked && styles.checkboxChecked]}
          >
            {consentChecked && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkLabel}>
            I confirm I have my parent/guardian&apos;s permission
          </Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={handleFinish}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Continue to App</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 13,
    fontSize: 15,
    backgroundColor: colors.card,
    marginBottom: 16,
  },
  bandRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  bandPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  bandPillActive: {
    backgroundColor: colors.primaryButton,
    borderColor: colors.primaryButton,
  },
  bandText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  bandTextActive: {
    color: '#fff',
  },
  consentBox: {
    backgroundColor: colors.primaryTint,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    marginBottom: 20,
  },
  consentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  consentBody: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 10,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.primaryButton,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: colors.primaryButton,
  },
  checkmark: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  checkLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
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
});
