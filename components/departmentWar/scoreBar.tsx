import React, { useRef, useEffect } from 'react';
import { View, Image, Animated, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ui/ThemedText';
import { useTheme } from '@/hooks/useTheme';

interface ScoreBarProps {
  myName: string;
  myAvatar: string | null;
  myScore: number;
  opponentName: string;
  opponentAvatar: string | null;
  opponentScore: number;
  isLeading: boolean;
  opponentAnswered?: boolean;
  myAnswered?: boolean;
  /** Points the local user just earned (null = no popup) */
  myLastPoints?: number | null;
  /** Points the opponent just earned (null = no popup) */
  oppLastPoints?: number | null;
}

export function ScoreBar({
  myName,
  myAvatar,
  myScore,
  opponentName,
  opponentAvatar,
  opponentScore,
  isLeading,
  opponentAnswered = false,
  myAnswered = false,
  myLastPoints = null,
  oppLastPoints = null,
}: ScoreBarProps) {
  const { colors, isDark } = useTheme();

  // ── Scale bounce for score numbers ──
  const myScoreScale = useRef(new Animated.Value(1)).current;
  const oppScoreScale = useRef(new Animated.Value(1)).current;
  const prevMyScore = useRef(myScore);
  const prevOppScore = useRef(opponentScore);

  // ── Background glow flash ──
  const myGlowAnim = useRef(new Animated.Value(0)).current;
  const oppGlowAnim = useRef(new Animated.Value(0)).current;

  // ── Floating +points opacity & translateY ──
  const myPointsOpacity = useRef(new Animated.Value(0)).current;
  const myPointsY = useRef(new Animated.Value(10)).current;
  const oppPointsOpacity = useRef(new Animated.Value(0)).current;
  const oppPointsY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (myScore !== prevMyScore.current) {
      prevMyScore.current = myScore;
      // Pop the score number: scale up to 1.4 then bounce back to 1
      myScoreScale.setValue(1);
      Animated.sequence([
        Animated.spring(myScoreScale, { toValue: 1.4, friction: 3, tension: 100, useNativeDriver: true }),
        Animated.spring(myScoreScale, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }),
      ]).start();
      // Flash the background glow
      myGlowAnim.setValue(0);
      Animated.sequence([
        Animated.timing(myGlowAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
        Animated.timing(myGlowAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
      ]).start();
    }
  }, [myScore]);

  useEffect(() => {
    if (opponentScore !== prevOppScore.current) {
      prevOppScore.current = opponentScore;
      oppScoreScale.setValue(1);
      Animated.sequence([
        Animated.spring(oppScoreScale, { toValue: 1.4, friction: 3, tension: 100, useNativeDriver: true }),
        Animated.spring(oppScoreScale, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }),
      ]).start();
      oppGlowAnim.setValue(0);
      Animated.sequence([
        Animated.timing(oppGlowAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
        Animated.timing(oppGlowAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
      ]).start();
    }
  }, [opponentScore]);

  // ── Floating +points animation ──
  useEffect(() => {
    if (myLastPoints != null && myLastPoints > 0) {
      myPointsOpacity.setValue(0);
      myPointsY.setValue(10);
      Animated.parallel([
        Animated.timing(myPointsOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(myPointsY, { toValue: -20, duration: 1200, useNativeDriver: true }),
      ]).start(() => {
        myPointsOpacity.setValue(0);
      });
    }
  }, [myLastPoints]);

  useEffect(() => {
    if (oppLastPoints != null && oppLastPoints > 0) {
      oppPointsOpacity.setValue(0);
      oppPointsY.setValue(10);
      Animated.parallel([
        Animated.timing(oppPointsOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(oppPointsY, { toValue: -20, duration: 1200, useNativeDriver: true }),
      ]).start(() => {
        oppPointsOpacity.setValue(0);
      });
    }
  }, [oppLastPoints]);

  const myGlowBg = myGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', '#10B98144'],
  });

  const oppGlowBg = oppGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', '#10B98144'],
  });

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
        borderRadius: 16,
        marginHorizontal: 16,
      }}
    >
      {/* My side */}
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        {myAvatar ? (
          <Image source={{ uri: myAvatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: isLeading ? '#10B981' : '#6C3EF4' }]}>
            <ThemedText style={styles.avatarLetter}>{myName.charAt(0).toUpperCase()}</ThemedText>
          </View>
        )}
        <View style={{ marginLeft: 8, flex: 1 }}>
          <ThemedText style={{ fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
            You
          </ThemedText>
          {myAnswered && (
            <ThemedText style={{ fontSize: 10, color: '#10B981', fontWeight: '500' }}>
              ✓ answered
            </ThemedText>
          )}
        </View>
      </View>

      {/* Score center — animated glow + bounce */}
      <View style={{ alignItems: 'center', position: 'relative' }}>
        {/* Floating +points popup (my side — left of score) */}
        {myLastPoints != null && myLastPoints > 0 && (
          <Animated.View
            style={{
              position: 'absolute',
              left: -30,
              top: 0,
              opacity: myPointsOpacity,
              transform: [{ translateY: myPointsY }],
              zIndex: 10,
            }}
          >
            <ThemedText style={{ fontSize: 14, fontWeight: '800', color: '#10B981' }}>
              +{myLastPoints}
            </ThemedText>
          </Animated.View>
        )}

        <Animated.View
          style={{
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 4,
            borderRadius: 12,
            backgroundColor: myGlowBg,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Animated.Text
              style={{
                fontSize: 28,
                fontWeight: '900',
                color: isLeading ? '#10B981' : colors.text,
                transform: [{ scale: myScoreScale }],
              }}
            >
              {myScore}
            </Animated.Text>
            <ThemedText style={{ fontSize: 20, fontWeight: '600', color: colors.muted, marginHorizontal: 8 }}>
              :
            </ThemedText>
            <Animated.Text
              style={{
                fontSize: 28,
                fontWeight: '900',
                color: !isLeading && myScore !== opponentScore ? '#10B981' : colors.text,
                transform: [{ scale: oppScoreScale }],
              }}
            >
              {opponentScore}
            </Animated.Text>
          </View>
        </Animated.View>

        {/* Floating +points popup (opponent side — right of score) */}
        {oppLastPoints != null && oppLastPoints > 0 && (
          <Animated.View
            style={{
              position: 'absolute',
              right: -30,
              top: 0,
              opacity: oppPointsOpacity,
              transform: [{ translateY: oppPointsY }],
              zIndex: 10,
            }}
          >
            <ThemedText style={{ fontSize: 14, fontWeight: '800', color: '#10B981' }}>
              +{oppLastPoints}
            </ThemedText>
          </Animated.View>
        )}
      </View>

      {/* Opponent side */}
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
        <View style={{ marginRight: 8, alignItems: 'flex-end', flex: 1 }}>
          <ThemedText style={{ fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
            Them
          </ThemedText>
          {opponentAnswered && (
            <ThemedText style={{ fontSize: 10, color: '#10B981', fontWeight: '500' }}>
              answered ✓
            </ThemedText>
          )}
        </View>
        {opponentAvatar ? (
          <Image source={{ uri: opponentAvatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: !isLeading && myScore !== opponentScore ? '#10B981' : '#EF4444' }]}>
            <ThemedText style={styles.avatarLetter}>{opponentName.charAt(0).toUpperCase()}</ThemedText>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
