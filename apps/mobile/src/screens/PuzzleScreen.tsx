import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { apiRequest, ApiClientError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme';

interface PuzzleSummary {
  id: string;
  title: string;
  difficultyTier: number;
  xpValue: number;
  solved: boolean;
}

interface PuzzleDetail {
  id: string;
  title: string;
  difficultyTier: number;
  boardPosition: string;
  hintText: string;
  xpValue: number;
}

const PIECE_UNICODE: Record<string, string> = {
  K: '♔',
  Q: '♕',
  R: '♖',
  B: '♗',
  N: '♘',
  P: '♙',
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function parseFenBoard(fen: string): Array<Array<string | null>> {
  const placement = fen.split(' ')[0] ?? '';
  return placement.split('/').map((rankStr) => {
    const row: Array<string | null> = [];
    for (const ch of rankStr) {
      const n = Number(ch);
      if (Number.isInteger(n) && n > 0) {
        for (let i = 0; i < n; i++) row.push(null);
      } else {
        row.push(ch);
      }
    }
    while (row.length < 8) row.push(null);
    return row.slice(0, 8);
  });
}

function squareName(r: number, c: number): string {
  return `${FILES[c]}${8 - r}`;
}

export function PuzzleScreen() {
  const { refreshProfile } = useAuth();
  const [list, setList] = useState<PuzzleSummary[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [puzzle, setPuzzle] = useState<PuzzleDetail | null>(null);
  const [board, setBoard] = useState<Array<Array<string | null>>>([]);
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(
    null,
  );
  const [moves, setMoves] = useState<string[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest<PuzzleSummary[]>('/puzzles');
        setList(res.data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const item = list[currentIdx];
    if (!item) return;
    (async () => {
      const res = await apiRequest<PuzzleDetail>(`/puzzles/${item.id}`);
      setPuzzle(res.data);
      setBoard(parseFenBoard(res.data.boardPosition));
      setSelected(null);
      setMoves([]);
      setHint(null);
    })();
  }, [list, currentIdx]);

  const handleSquareTap = (r: number, c: number) => {
    if (!selected) {
      if (board[r]?.[c]) {
        setSelected({ r, c });
      }
      return;
    }

    if (selected.r === r && selected.c === c) {
      setSelected(null);
      return;
    }

    const piece = board[selected.r]?.[selected.c];
    if (!piece) {
      setSelected(null);
      return;
    }

    const prefix = piece.toUpperCase() === 'P' ? '' : piece.toUpperCase();
    const moveStr = `${prefix}${squareName(selected.r, selected.c)}-${squareName(r, c)}`;

    const nextBoard = board.map((row) => [...row]);
    nextBoard[r][c] = piece;
    nextBoard[selected.r][selected.c] = null;

    setBoard(nextBoard);
    setSelected(null);
    setMoves((prev) => [...prev, moveStr]);
  };

  const handleReset = () => {
    if (!puzzle) return;
    setBoard(parseFenBoard(puzzle.boardPosition));
    setSelected(null);
    setMoves([]);
  };

  const handleCheck = async () => {
    if (!puzzle || moves.length === 0) {
      Alert.alert('Make a move', 'Tap a piece, then tap where it should move.');
      return;
    }
    try {
      const res = await apiRequest<{
        correct: boolean;
        hintText?: string;
        xpAwarded: number;
      }>(`/puzzles/${puzzle.id}/attempt`, {
        method: 'POST',
        body: { moves },
      });

      if (res.data.correct) {
        await refreshProfile();
        Alert.alert(
          'Solved!',
          res.data.xpAwarded > 0
            ? `Great move! +${res.data.xpAwarded} XP`
            : 'Correct!',
        );
        if (currentIdx + 1 < list.length) {
          setCurrentIdx((i) => i + 1);
        }
      } else {
        setHint(res.data.hintText ?? puzzle.hintText);
        handleReset();
      }
    } catch (err) {
      const msg =
        err instanceof ApiClientError ? err.message : 'Check failed.';
      Alert.alert('Error', msg);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primaryButton} />
      </View>
    );
  }

  if (!puzzle) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>No puzzles available yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.progress}>
        Puzzle {currentIdx + 1} of {list.length} · Tier {puzzle.difficultyTier}
      </Text>
      <Text style={styles.title}>{puzzle.title}</Text>

      <View style={styles.board}>
        {board.map((row, r) => (
          <View key={r} style={styles.boardRow}>
            {row.map((piece, c) => {
              const isDark = (r + c) % 2 === 1;
              const isSelected = selected?.r === r && selected?.c === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => handleSquareTap(r, c)}
                  style={[
                    styles.square,
                    { backgroundColor: isDark ? '#84A98C' : '#F3F4F6' },
                    isSelected && styles.squareSelected,
                  ]}
                >
                  <Text style={styles.piece}>
                    {piece ? (PIECE_UNICODE[piece] ?? piece) : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <Text style={styles.instruction}>
        Tap a piece, then tap where it should move
        {moves.length > 0 ? `  ·  Moves: ${moves.join(', ')}` : ''}
      </Text>

      {hint && (
        <View style={styles.hintBox}>
          <Text style={styles.hintText}>Hint: {hint}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable style={styles.resetBtn} onPress={handleReset}>
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
        <Pressable style={styles.checkBtn} onPress={handleCheck}>
          <Text style={styles.checkText}>Check Move</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.textMuted, fontSize: 15 },
  container: { padding: 16, backgroundColor: colors.background, gap: 14 },
  progress: { fontSize: 13, fontWeight: '700', color: colors.primaryButton },
  title: { fontSize: 20, fontWeight: '800', color: colors.primary },
  board: {
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 6,
    overflow: 'hidden',
  },
  boardRow: { flexDirection: 'row' },
  square: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareSelected: {
    borderWidth: 2.5,
    borderColor: colors.primary,
    backgroundColor: '#BBF7D0',
  },
  piece: { fontSize: 26 },
  instruction: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.textMuted,
  },
  hintBox: {
    backgroundColor: colors.primaryTint,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  hintText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  resetBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  resetText: { fontWeight: '700', color: colors.text },
  checkBtn: {
    flex: 1,
    backgroundColor: colors.primaryButton,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
