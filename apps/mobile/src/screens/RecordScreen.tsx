import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { apiRequest, ApiClientError } from '../api/client';
import { colors } from '../theme';

interface WasteLogItem {
  id: string;
  bagCount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote: string | null;
  createdAt: string;
}

export function RecordScreen() {
  const [bagCount, setBagCount] = useState(1);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [logs, setLogs] = useState<WasteLogItem[]>([]);

  const loadMyLogs = useCallback(async () => {
    try {
      const res = await apiRequest<WasteLogItem[]>('/users/me/waste-logs');
      setLogs(res.data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadMyLogs();
  }, [loadMyLogs]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission needed',
        'Allow photo access to attach a picture of your collected bags.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!photoUri) {
      Alert.alert('Photo required', 'Please select or take a photo first.');
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('bagCount', String(bagCount));
      form.append('photo', {
        uri: photoUri,
        name: 'ecoscan.jpg',
        type: 'image/jpeg',
      } as unknown as Blob);

      await apiRequest('/waste-logs', {
        method: 'POST',
        body: form,
        isFormData: true,
      });

      Alert.alert(
        'Submitted!',
        'Your entry is now pending facilitator review.',
      );
      setPhotoUri(null);
      setBagCount(1);
      await loadMyLogs();
    } catch (err) {
      const msg =
        err instanceof ApiClientError ? err.message : 'Submission failed.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Log Sachets (EcoScan)</Text>

      <Pressable style={styles.photoBox} onPress={pickPhoto}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.preview} />
        ) : (
          <Text style={styles.photoPlaceholder}>
            Tap to select or upload a photo
          </Text>
        )}
      </Pressable>

      <Text style={styles.label}>Bags of sachets collected</Text>
      <View style={styles.stepperRow}>
        <View style={styles.countBox}>
          <Text style={styles.countText}>{bagCount}</Text>
        </View>
        <Pressable
          style={styles.stepBtn}
          onPress={() => setBagCount((c) => Math.max(1, c - 1))}
        >
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Pressable
          style={[styles.stepBtn, styles.stepBtnPlus]}
          onPress={() => setBagCount((c) => c + 1)}
        >
          <Text style={[styles.stepBtnText, { color: '#fff' }]}>+</Text>
        </Pressable>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Pending facilitator review</Text>
        <Text style={styles.infoBody}>
          Verified entries count toward your school total and Green Points.
        </Text>
      </View>

      <Pressable
        style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitBtnText}>Submit for Review</Text>
        )}
      </Pressable>

      {logs.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>My Submissions</Text>
          {logs.map((item) => (
            <View key={item.id} style={styles.historyCard}>
              <View>
                <Text style={styles.historyBags}>{item.bagCount} bags</Text>
                <Text style={styles.historyDate}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  item.status === 'APPROVED' && {
                    backgroundColor: colors.primaryLight,
                  },
                  item.status === 'REJECTED' && {
                    backgroundColor: colors.dangerLight,
                  },
                ]}
              >
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14 },
  title: { fontSize: 22, fontWeight: '800', color: colors.primary },
  photoBox: {
    height: 180,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  preview: { width: '100%', height: '100%' },
  photoPlaceholder: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  label: { fontSize: 15, fontWeight: '700', color: colors.text },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  countBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  countText: { fontSize: 18, fontWeight: '700', color: colors.text },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPlus: { backgroundColor: colors.primaryButton },
  stepBtnText: { fontSize: 22, fontWeight: '700', color: colors.text },
  infoBox: {
    backgroundColor: colors.primaryTint,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: colors.primary },
  infoBody: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  submitBtn: {
    backgroundColor: colors.primaryButton,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  historySection: { marginTop: 12, gap: 8 },
  historyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  historyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyBags: { fontSize: 15, fontWeight: '700', color: colors.text },
  historyDate: { fontSize: 12, color: colors.textMuted },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.warningLight,
  },
  statusText: { fontSize: 12, fontWeight: '700', color: colors.text },
});
