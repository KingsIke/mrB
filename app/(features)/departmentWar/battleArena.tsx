import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BackHandler, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/ui/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useDepartmentWarStore } from '@/store/departmentWarStore';
import { departmentWarService } from '@/service/departmentWar.service';
import { useWarSocket, type BattleStartPayload, type QuestionStartPayload, type ScoreUpdatePayload, type BattleEndedPayload, type ChallengeRejectedPayload } from '@/service/useWarSocket';
import { QuestionCard } from '@/components/departmentWar/questionCard';
import { ScoreBar } from '@/components/departmentWar/scoreBar';
import { CountdownOverlay } from '@/components/departmentWar/countdownOverlay';
import { WarRewardModal } from '@/components/departmentWar/warRewardModal';
import { showError } from '@/components/ui/toast';

export default function BattleArenaScreen() {
  const router = useRouter();
  const { battleId } = useLocalSearchParams<{ battleId: string }>();
  const { colors } = useTheme();
  const currentUser = useAuthStore((state) => state.user);
  const { questions, setQuestions, currentQuestion, setCurrentQuestion, myScore, setMyScore, opponentScore, setOpponentScore, opponentInfo, setActiveBattle, lastResult, setLastResult, resetBattle } = useDepartmentWarStore();

  const [showCountdown, setShowCountdown] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(15);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartTimeRef = useRef<number>(0);
  const initializedRef = useRef(false);
  const totalQuestions = questions.length;
  const [opponentAnswered, setOpponentAnswered] = useState(false);
  const [myLastPoints, setMyLastPoints] = useState<number | null>(null);
  const [oppLastPoints, setOppLastPoints] = useState<number | null>(null);

  const getAmPlayer1 = useCallback(() => {
    const battle = useDepartmentWarStore.getState().activeBattle;
    return battle != null && currentUser?.id === battle.player1Id;
  }, [currentUser?.id]);

  const clearTimer = useCallback(() => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } }, []);

  const showResultBriefly = useCallback((result: { isCorrect: boolean; correctOption?: number; selectedOption: number | null }) => {
    setCurrentQuestion({ selectedOption: result.selectedOption, result: result.isCorrect ? 'correct' : 'wrong', correctOption: result.correctOption ?? null });
    setTimeout(() => setCurrentQuestion({ result: null, correctOption: null, selectedOption: null }), 2000);
  }, []);

  const startQuestionTimer = useCallback((seconds: number) => {
    clearTimer(); setTimeRemaining(seconds); questionStartTimeRef.current = Date.now(); setIsLocked(false); setOpponentAnswered(false);
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) { clearTimer(); if (!isLocked && battleId) { setIsLocked(true); const qi = useDepartmentWarStore.getState().currentQuestion.questionIndex; departmentWarService.submitAnswer(battleId, qi, 0, seconds * 1000).then((r) => showResultBriefly({ isCorrect: r.isCorrect, correctOption: r.correctOption, selectedOption: null })).catch(() => {}); } return 0; }
        return prev - 1;
      });
    }, 1000);
  }, [clearTimer, battleId, isLocked, showResultBriefly]);

  useEffect(() => { if (questions.length > 0 && !initializedRef.current) { initializedRef.current = true; setShowCountdown(true); const t = setTimeout(() => { setShowCountdown(false); startQuestionTimer(15); }, 3500); return () => clearTimeout(t); } }, [questions.length]);

  const { joinBattleRoom, leaveBattleRoom } = useWarSocket({
    onBattleStart: (data: BattleStartPayload) => { if (data.battleId === battleId && !initializedRef.current) { setQuestions(data.questions as any); setCurrentQuestion({ questionIndex: 0, selectedOption: null, result: null, correctOption: null }); setMyScore(0); setOpponentScore(0); } },
    onQuestionStart: (data: QuestionStartPayload) => { if (data.battleId === battleId) { setCurrentQuestion({ questionIndex: data.questionIndex, selectedOption: null, result: null, correctOption: null }); setIsLocked(false); setOpponentAnswered(false); setMyLastPoints(null); setOppLastPoints(null); if (data.player1Score != null && data.player2Score != null) { const amP1 = getAmPlayer1(); setMyScore(amP1 ? data.player1Score : data.player2Score); setOpponentScore(amP1 ? data.player2Score : data.player1Score); } startQuestionTimer(15); } },
    onScoreUpdate: (data: ScoreUpdatePayload) => { if (data.battleId !== battleId) return; const amP1 = getAmPlayer1(); setMyScore(amP1 ? data.player1Score : data.player2Score); setOpponentScore(amP1 ? data.player2Score : data.player1Score); if (data.youAnswered) { setMyLastPoints(data.pointsEarned); setTimeout(() => setMyLastPoints(null), 1500); } else { setOppLastPoints(data.pointsEarned); setTimeout(() => setOppLastPoints(null), 1500); } setOpponentAnswered(amP1 ? data.player2Answered : data.player1Answered); },
    onBattleEnded: (data: BattleEndedPayload) => { if (data.battleId === battleId) { clearTimer(); const amP1 = getAmPlayer1(); const myF = amP1 ? data.player1Score : data.player2Score; const oppF = amP1 ? data.player2Score : data.player1Score; setMyScore(myF); setOpponentScore(oppF); setLastResult({ winnerId: data.winnerId, myScore: myF, opponentScore: oppF, departmentPoints: data.departmentPoints, stats: data.stats }); setShowResults(true); } },
    onChallengeRejected: (data: ChallengeRejectedPayload) => { if (data.battleId === battleId) { Alert.alert('No Battle', data.reason === 'expired' ? "Your opponent didn't respond in time." : 'Your opponent declined the battle request.', [{ text: 'OK', onPress: () => { resetBattle(); router.dismissAll(); setTimeout(() => router.replace('/(features)/departmentWar'), 50); } }]); } },
  });

  useEffect(() => { if (battleId) { joinBattleRoom(battleId); departmentWarService.getActiveBattle().then((b) => { if (b && b.id === battleId) setActiveBattle(b); }).catch(() => {}); } return () => { clearTimer(); if (battleId) leaveBattleRoom(battleId); }; }, [battleId]);

  const handleSelectOption = useCallback(async (optionIndex: number) => {
    if (isLocked || !battleId) return; setIsLocked(true); clearTimer();
    try { const result = await departmentWarService.submitAnswer(battleId, currentQuestion.questionIndex, optionIndex, Date.now() - questionStartTimeRef.current); const amP1 = getAmPlayer1(); setMyScore(amP1 ? result.player1Score : result.player2Score); setOpponentScore(amP1 ? result.player2Score : result.player1Score); showResultBriefly({ isCorrect: result.isCorrect, correctOption: result.correctOption, selectedOption: optionIndex }); } catch (err: any) { showError(err?.response?.data?.message || 'Failed to submit answer'); setIsLocked(false); }
  }, [isLocked, battleId, currentQuestion.questionIndex]);

  // Block back button during the entire battle lifecycle (including results modal)
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => true);
    return handler.remove();
  }, []);

  // When closing results, completely replace the stack so back can't return here
  const handleCloseResults = () => {
    setShowResults(false);
    resetBattle();
    // dismissAll clears the entire stack (removes battleArena), then replace puts deptWar on top
    router.dismissAll();
    setTimeout(() => router.replace('/(features)/departmentWar'), 50);
  };

  if (questions.length === 0) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><ThemedText style={{ color: colors.muted }}>Waiting for battle to start...</ThemedText></SafeAreaView>;

  const currentQ = questions[currentQuestion.questionIndex];
  const isLeading = myScore > opponentScore;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScoreBar myName={currentUser?.username || 'You'} myAvatar={currentUser?.profilePictureUrl || null} myScore={myScore} opponentName={opponentInfo?.username || 'Opponent'} opponentAvatar={opponentInfo?.profilePictureUrl || null} opponentScore={opponentScore} isLeading={isLeading} opponentAnswered={opponentAnswered} myAnswered={isLocked} myLastPoints={myLastPoints} oppLastPoints={oppLastPoints} />
      {currentQ && <QuestionCard questionText={currentQ.questionText} options={currentQ.options} questionIndex={currentQuestion.questionIndex} totalQuestions={totalQuestions} selectedOption={currentQuestion.selectedOption} result={currentQuestion.result} correctOption={currentQuestion.correctOption} timeRemaining={timeRemaining} timePerQuestion={15} onSelectOption={handleSelectOption} disabled={isLocked} />}
      {isLocked && !opponentAnswered && currentQuestion.result === null && <ThemedText style={{ textAlign: 'center', color: colors.muted, marginTop: 12, fontSize: 14 }}>Waiting for opponent...</ThemedText>}
      <CountdownOverlay visible={showCountdown} onComplete={() => setShowCountdown(false)} />
      {lastResult && <WarRewardModal visible={showResults} isWinner={lastResult.winnerId === currentUser?.id} isDraw={lastResult.winnerId === null} myScore={lastResult.myScore} opponentScore={lastResult.opponentScore} departmentPoints={lastResult.departmentPoints} onClose={handleCloseResults} />}
    </SafeAreaView>
  );
}
