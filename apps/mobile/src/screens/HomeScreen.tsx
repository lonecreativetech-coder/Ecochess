import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme';

interface LessonSummary {
  id: string;
  title: string;
  track: 'CHESS_TACTICS' | 'ECO_LITERACY';
  order: number;
  xpValue: number;
  completed: boolean;
}

interface EventSummary {
  id: string;
  title: string;
  date: string;
  venue: string;
}

export function HomeScreen() {
  const { user, refreshProfile, signOut } = useAuth();
  const navigation = useNavigation<any>();
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [nextEvent, setNextEvent] = useState<EventSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [lessonsRes, eventsRes] = await Promise.all([
        apiRequest<LessonSummary[]>('/lessons'),
        apiRequest<EventSummary[]>('/events'),
      ]);
      setLessons(lessonsRes.data);
      setNextEvent(eventsRes.data[0] ?? null);
    } catch {
      // Handled silently on initial load
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), loadData()]);
    setRefreshing(false);
  };

  const nextChess = lessons.find(
    (l) => l.track === 'CHESS_TACTICS' && !l.completed,
  ) ?? lessons.find((l) => l.track === 'CHESS_TACTICS');

  const nextEco = lessons.find(
    (l) => l.track === 'ECO_LITERACY' && !l.completed,
  ) ?? lessons.find((l) => l.track === 'ECO_LITERACY');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Hi, {user?.name ?? 'Student'}</Text>
        <Pressable onPress={signOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>

      {/* Top Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>Lifetime XP</Text>
            <Text style={styles.summaryValue}>
              {user?.lifetimeGreenPoints ?? 0}
            </Text>
            <Text style={styles.gpSub}>
              Spendable GP: {user?.greenPointBalance ?? 0}
            </Text>
          </View>
          <View style={styles.rightStats}>
            <Text style={styles.summaryLabel}>Streak</Text>
            <Text style={styles.streakValue}>
              {user?.streakCount ?? 0} days
            </Text>
            <Text style={styles.rankBadge}>
              Rank: {user?.rank?.name ?? 'Sprout'}
            </Text>
          </View>
        </View>
      </View>

      {/* Chess Tactics Card */}
      {nextChess && (
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Continue Chess Tactics</Text>
              <Text style={styles.cardSubtitle}>{nextChess.title}</Text>
            </View>
            <Pressable
              style={styles.pillBtn}
              onPress={() =>
                navigation.navigate('Lesson', { lessonId: nextChess.id })
              }
            >
              <Text style={styles.pillBtnText}>
                {nextChess.completed ? 'Review' : 'Resume'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Eco-Literacy Card */}
      {nextEco && (
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Eco-Literacy Today</Text>
              <Text style={styles.cardSubtitle}>{nextEco.title}</Text>
            </View>
            <Pressable
              style={styles.pillBtn}
              onPress={() =>
                navigation.navigate('Lesson', { lessonId: nextEco.id })
              }
            >
              <Text style={styles.pillBtnText}>
                {nextEco.completed ? 'Review' : 'Start'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* EcoScan Banner */}
      <Pressable
        style={styles.ecoBanner}
        onPress={() => navigation.navigate('Record')}
      >
        <View style={styles.cardInfo}>
          <Text style={styles.ecoTitle}>Log today&apos;s sachets</Text>
          <Text style={styles.ecoSubtitle}>
            Snap a photo to add to your school total
          </Text>
        </View>
        <View style={styles.ecoCta}>
          <Text style={styles.ecoCtaText}>EcoScan</Text>
        </View>
      </Pressable>

      {/* Chess Puzzle Shortcut */}
      <Pressable
        style={styles.card}
        onPress={() => navigation.navigate('Puzzle')}
      >
        <View style={styles.cardRow}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>Chess Practice Puzzles</Text>
            <Text style={styles.cardSubtitle}>
              Sharpen your tactics with solo puzzles
            </Text>
          </View>
          <Text style={styles.linkArrow}>Play →</Text>
        </View>
      </Pressable>

      {/* Upcoming Event */}
      {nextEvent && (
        <Pressable
          style={styles.card}
          onPress={() => navigation.navigate('Activity')}
        >
          <View style={styles.cardRow}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Upcoming: {nextEvent.title}</Text>
              <Text style={styles.cardSubtitle}>
                {new Date(nextEvent.date).toDateString()} · {nextEvent.venue}
              </Text>
            </View>
            <Text style={styles.linkArrow}>View →</Text>
          </View>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.primary },
  signOutBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  signOutText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  summaryCard: {
    backgroundColor: colors.primaryTint,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  summaryValue: { fontSize: 30, fontWeight: '800', color: colors.text },
  gpSub: { fontSize: 12, color: colors.primaryButton, fontWeight: '600' },
  rightStats: { alignItems: 'flex-end' },
  streakValue: { fontSize: 24, fontWeight: '800', color: colors.primaryButton },
  rankBadge: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  pillBtn: {
    backgroundColor: colors.primaryButton,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  pillBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  ecoBanner: {
    backgroundColor: colors.primaryButton,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  ecoTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  ecoSubtitle: { fontSize: 13, color: colors.primaryLight, marginTop: 2 },
  ecoCta: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  ecoCtaText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  linkArrow: { color: colors.primaryButton, fontWeight: '700', fontSize: 14 },
});
