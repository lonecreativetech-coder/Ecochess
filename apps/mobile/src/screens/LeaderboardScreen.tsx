import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { apiRequest } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme';

interface LeaderboardRow {
  id: string;
  entityId: string;
  entityName: string;
  xpTotal: number;
  rank: number;
}

export function LeaderboardScreen() {
  const { user } = useAuth();
  const [scope, setScope] = useState<'individual' | 'school'>('individual');
  const [items, setItems] = useState<LeaderboardRow[]>([]);
  const [myRank, setMyRank] = useState<LeaderboardRow | null>(null);
  const [mySchool, setMySchool] = useState<LeaderboardRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [listRes, meRes] = await Promise.all([
        apiRequest<{ items: LeaderboardRow[]; updatedAt: string | null }>(
          `/leaderboard?scope=${scope}`,
        ),
        apiRequest<{
          individual: LeaderboardRow | null;
          school: LeaderboardRow | null;
        }>('/leaderboard/me'),
      ]);
      setItems(listRes.data.items);
      setMyRank(meRes.data.individual);
      setMySchool(meRes.data.school);
    } catch {
      // ignore
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  const userInList = items.some((row) => row.entityId === user?.id);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <Text style={styles.title}>Leaderboard</Text>

      <View style={styles.toggleRow}>
        <Pressable
          style={[
            styles.toggleBtn,
            scope === 'individual' && styles.toggleBtnActive,
          ]}
          onPress={() => setScope('individual')}
        >
          <Text
            style={[
              styles.toggleText,
              scope === 'individual' && styles.toggleTextActive,
            ]}
          >
            Individual
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.toggleBtn,
            scope === 'school' && styles.toggleBtnActive,
          ]}
          onPress={() => setScope('school')}
        >
          <Text
            style={[
              styles.toggleText,
              scope === 'school' && styles.toggleTextActive,
            ]}
          >
            School
          </Text>
        </Pressable>
      </View>

      <View style={styles.listCard}>
        {items.map((row) => {
          const isMe = scope === 'individual' && row.entityId === user?.id;
          return (
            <View
              key={row.id}
              style={[styles.row, isMe && styles.rowHighlight]}
            >
              <Text style={[styles.rankCol, isMe && styles.textHighlight]}>
                {row.rank}
              </Text>
              <Text style={[styles.nameCol, isMe && styles.textHighlight]}>
                {row.entityName} {isMe ? '(You)' : ''}
              </Text>
              <Text style={[styles.xpCol, isMe && styles.textHighlight]}>
                {row.xpTotal.toLocaleString()}
              </Text>
            </View>
          );
        })}

        {scope === 'individual' && !userInList && myRank && (
          <View style={[styles.row, styles.rowHighlight, { marginTop: 8 }]}>
            <Text style={[styles.rankCol, styles.textHighlight]}>
              {myRank.rank}
            </Text>
            <Text style={[styles.nameCol, styles.textHighlight]}>
              {myRank.entityName} (You)
            </Text>
            <Text style={[styles.xpCol, styles.textHighlight]}>
              {myRank.xpTotal.toLocaleString()}
            </Text>
          </View>
        )}
      </View>

      {mySchool && (
        <View style={styles.schoolCard}>
          <Text style={styles.schoolTitle}>
            Your school: {mySchool.entityName}
          </Text>
          <Text style={styles.schoolSub}>
            Ranked #{mySchool.rank} · {mySchool.xpTotal.toLocaleString()} XP
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14 },
  title: { fontSize: 22, fontWeight: '800', color: colors.primary },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: colors.primaryButton },
  toggleText: { fontWeight: '700', color: colors.textMuted, fontSize: 14 },
  toggleTextActive: { color: '#fff' },
  listCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  rowHighlight: { backgroundColor: colors.primaryButton },
  rankCol: { width: 36, fontWeight: '700', fontSize: 15, color: colors.text },
  nameCol: { flex: 1, fontWeight: '600', fontSize: 15, color: colors.text },
  xpCol: { fontWeight: '700', fontSize: 15, color: colors.text },
  textHighlight: { color: '#fff' },
  schoolCard: {
    backgroundColor: colors.primaryTint,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  schoolTitle: { fontSize: 15, fontWeight: '800', color: colors.primary },
  schoolSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
