import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiRequest, ApiClientError } from '../api/client';
import { colors } from '../theme';

interface EventItem {
  id: string;
  title: string;
  type: 'TOURNAMENT' | 'CLEANUP' | 'WORKSHOP';
  date: string;
  venue: string;
  registered: boolean;
}

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'tournament', label: 'Tournaments' },
  { key: 'cleanup', label: 'Cleanups' },
  { key: 'workshop', label: 'Workshops' },
];

export function ActivityScreen() {
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState('');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      const qs = filter ? `?type=${filter}` : '';
      const res = await apiRequest<EventItem[]>(`/events${qs}`);
      setEvents(res.data);
    } catch {
      // ignore
    }
  }, [filter]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const toggleRegister = async (item: EventItem) => {
    try {
      if (item.registered) {
        await apiRequest(`/events/${item.id}/register`, { method: 'DELETE' });
      } else {
        await apiRequest(`/events/${item.id}/register`, { method: 'POST' });
      }
      await loadEvents();
    } catch (err) {
      const msg =
        err instanceof ApiClientError ? err.message : 'Action failed.';
      Alert.alert('Event', msg);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await loadEvents();
            setRefreshing(false);
          }}
        />
      }
    >
      <Text style={styles.title}>Activity & Events</Text>

      <Pressable
        style={styles.puzzleCard}
        onPress={() => navigation.navigate('Puzzle')}
      >
        <Text style={styles.puzzleTitle}>Solo Chess Puzzles</Text>
        <Text style={styles.puzzleSub}>Practice tactics & earn XP →</Text>
      </Pressable>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[
              styles.filterPill,
              filter === f.key && styles.filterPillActive,
            ]}
            onPress={() => setFilter(f.key)}
          >
            <Text
              style={[
                styles.filterText,
                filter === f.key && styles.filterTextActive,
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {events.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            No upcoming events in this category yet.
          </Text>
        </View>
      ) : (
        events.map((ev) => (
          <View key={ev.id} style={styles.eventCard}>
            <View style={styles.eventInfo}>
              <Text style={styles.eventTitle}>{ev.title}</Text>
              <Text style={styles.eventMeta}>
                {new Date(ev.date).toDateString()} · {ev.venue}
              </Text>
            </View>
            <Pressable
              style={[
                styles.ctaBtn,
                ev.registered && styles.ctaBtnRegistered,
              ]}
              onPress={() => toggleRegister(ev)}
            >
              <Text
                style={[
                  styles.ctaText,
                  ev.registered && styles.ctaTextRegistered,
                ]}
              >
                {ev.registered ? 'Registered ✓' : 'Register'}
              </Text>
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.primary },
  puzzleCard: {
    backgroundColor: colors.primaryTint,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  puzzleTitle: { fontSize: 16, fontWeight: '800', color: colors.primary },
  puzzleSub: { fontSize: 13, color: colors.primaryButton, marginTop: 2 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.primaryButton,
    borderColor: colors.primaryButton,
  },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.text },
  filterTextActive: { color: '#fff' },
  emptyBox: {
    padding: 24,
    backgroundColor: colors.card,
    borderRadius: 14,
    alignItems: 'center',
  },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  eventCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  eventMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  ctaBtn: {
    backgroundColor: colors.primaryButton,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  ctaBtnRegistered: {
    backgroundColor: colors.primaryLight,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  ctaTextRegistered: { color: colors.primary },
});
