import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { apiRequest, ApiClientError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme';

interface LessonCard {
  type: 'text' | 'multiple_choice';
  body?: string;
  question?: string;
  options?: string[];
  answer?: string;
}

interface LessonDetail {
  id: string;
  title: string;
  xpValue: number;
  completed: boolean;
  contentPayload: { cards?: LessonCard[] };
}

export function LessonScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { refreshProfile } = useAuth();
  const lessonId: string = route.params?.lessonId;

  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [index, setIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest<LessonDetail>(`/lessons/${lessonId}`);
        setLesson(res.data);
      } catch {
        Alert.alert('Error', 'Could not load lesson.');
        navigation.goBack();
      }
    })();
  }, [lessonId, navigation]);

  if (!lesson) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primaryButton} />
      </View>
    );
  }

  const cards = lesson.contentPayload?.cards ?? [
    { type: 'text' as const, body: lesson.title },
  ];
  const current = cards[index];
  const isLast = index === cards.length - 1;

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const res = await apiRequest<{
        alreadyCompleted: boolean;
        xpAwarded: number;
      }>(`/lessons/${lesson.id}/complete`, { method: 'POST' });
      await refreshProfile();
      Alert.alert(
        res.data.alreadyCompleted ? 'Lesson Reviewed' : 'Lesson Complete!',
        res.data.alreadyCompleted
          ? 'Great practice!'
          : `You earned +${res.data.xpAwarded} XP & Green Points!`,
      );
      navigation.goBack();
    } catch (err) {
      const msg =
        err instanceof ApiClientError ? err.message : 'Could not complete.';
      Alert.alert('Error', msg);
    } finally {
      setCompleting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        Card {index + 1} of {cards.length}
      </Text>
      <Text style={styles.title}>{lesson.title}</Text>

      <View style={styles.card}>
        {current.type === 'multiple_choice' ? (
          <>
            <Text style={styles.cardBody}>{current.question}</Text>
            <View style={styles.options}>
              {(current.options ?? []).map((opt) => {
                const chosen = selectedOption === opt;
                const correct = chosen && opt === current.answer;
                return (
                  <Pressable
                    key={opt}
                    style={[
                      styles.optionBtn,
                      chosen && {
                        borderColor: correct
                          ? colors.primaryButton
                          : colors.danger,
                        backgroundColor: correct
                          ? colors.primaryTint
                          : colors.dangerLight,
                      },
                    ]}
                    onPress={() => setSelectedOption(opt)}
                  >
                    <Text style={styles.optionText}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <Text style={styles.cardBody}>{current.body}</Text>
        )}
      </View>

      <View style={styles.navRow}>
        <Pressable
          style={[styles.secondaryBtn, index === 0 && { opacity: 0.4 }]}
          disabled={index === 0}
          onPress={() => {
            setSelectedOption(null);
            setIndex((i) => Math.max(0, i - 1));
          }}
        >
          <Text style={styles.secondaryText}>← Back</Text>
        </Pressable>

        {isLast ? (
          <Pressable
            style={styles.primaryBtn}
            onPress={handleComplete}
            disabled={completing}
          >
            <Text style={styles.primaryText}>
              {completing ? 'Saving...' : 'Complete Lesson ✓'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              setSelectedOption(null);
              setIndex((i) => i + 1);
            }}
          >
            <Text style={styles.primaryText}>Next →</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
  },
  progress: { fontSize: 13, fontWeight: '700', color: colors.primaryButton },
  title: { fontSize: 22, fontWeight: '800', color: colors.primary, marginTop: 4 },
  card: {
    flex: 1,
    marginVertical: 20,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  cardBody: { fontSize: 18, lineHeight: 26, color: colors.text, fontWeight: '600' },
  options: { marginTop: 20, gap: 10 },
  optionBtn: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  optionText: { fontSize: 15, fontWeight: '600', color: colors.text },
  navRow: { flexDirection: 'row', gap: 12 },
  secondaryBtn: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  secondaryText: { fontWeight: '700', color: colors.text },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.primaryButton,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
