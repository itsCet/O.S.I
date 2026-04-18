import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, signIn } from './firebase';
import { 
  Skull, 
  UserX, 
  Shield, 
  Eye, 
  Search, 
  Zap, 
  Lock, 
  Unlock, 
  Timer, 
  Settings, 
  Play, 
  Pause, 
  RotateCcw,
  AlertTriangle,
  Ghost,
  Stethoscope,
  Terminal,
  MessageSquare,
  VolumeX,
  TrendingUp,
  Radio,
  Dna,
  Users,
  HelpCircle,
  Cpu,
  ClipboardList,
  Moon
} from 'lucide-react';
import { NightActionModal } from './components/NightActionModal';

// --- Types ---

export type PlayerStatus = 'active' | 'eliminated';

export type RoleType = 
  | 'Espion' 
  | 'Agent Secret' 
  | 'Ingénieur' 
  | 'Enquêteur' 
  | 'Agent Double' 
  | 'Polygraphiste' 
  | 'Stratège' 
  | 'Supérieur Hiérarchique' 
  | 'Agent Russe' 
  | 'Hacker' 
  | 'Négociateur' 
  | 'Médecin' 
  | 'Agent Gemini' 
  | 'Agent Fantôme' 
  | 'Recrue';

export interface Player {
  id: number;
  name: string;
  role: RoleType;
  status: PlayerStatus;
  revealed: boolean;
}

export type GamePhase = 'Day' | 'Night';

export type GameEvent = 
  | 'None'
  | 'Silence' 
  | 'Mission Chaos' 
  | 'Veillée' 
  | 'Promotion' 
  | 'Protection Renforcée' 
  | 'Brouilleur d\'ondes';

// --- Constants ---

export const ROLES_CONFIG: Record<RoleType, { color: string; icon: React.ReactNode; description: string; phase: 'night' | 'day' | 'both'; camp: 'agent' | 'spy' | 'neutral'; image: string }> = {
  'Espion': { color: 'text-red-500', icon: <Eye size={16} />, description: 'Élimine un agent chaque nuit.', phase: 'night', camp: 'spy', image: '/cards/espion.png' },
  'Agent Secret': { color: 'text-cyan-400', icon: <Lock size={16} />, description: 'Détient une partie du code secret.', phase: 'both', camp: 'agent', image: '/cards/agent_secret.png' },
  'Ingénieur': { color: 'text-emerald-400', icon: <Settings size={16} />, description: 'Place un dispositif de surveillance.', phase: 'night', camp: 'agent', image: '/cards/ingenieur.png' },
  'Enquêteur': { color: 'text-cyan-400', icon: <Search size={16} />, description: 'Interroge sur l\'utilisation d\'un pouvoir.', phase: 'night', camp: 'agent', image: '/cards/enqueteur.png' },
  'Agent Double': { color: 'text-orange-400', icon: <Dna size={16} />, description: 'Choisit son camp (Espion/Agent).', phase: 'night', camp: 'neutral', image: '/cards/agent_double.png' },
  'Polygraphiste': { color: 'text-yellow-400', icon: <TrendingUp size={16} />, description: 'Teste un groupe de 3 agents.', phase: 'night', camp: 'agent', image: '/cards/polygraphiste.png' },
  'Stratège': { color: 'text-purple-400', icon: <Zap size={16} />, description: 'Place un mouchard (votes doubles).', phase: 'night', camp: 'agent', image: '/cards/stratege.png' },
  'Supérieur Hiérarchique': { color: 'text-emerald-400', icon: <Shield size={16} />, description: 'Peut tuer une personne en journée.', phase: 'day', camp: 'agent', image: '/cards/superieur_hierarchique.png' },
  'Agent Russe': { color: 'text-red-400', icon: <RotateCcw size={16} />, description: 'Roulette russe à sa mort.', phase: 'day', camp: 'neutral', image: '/cards/agent_russe.png' },
  'Hacker': { color: 'text-emerald-400', icon: <Terminal size={16} />, description: 'Inverse la règle d\'élimination.', phase: 'day', camp: 'agent', image: '/cards/hacker.png' },
  'Négociateur': { color: 'text-purple-400', icon: <MessageSquare size={16} />, description: 'Sauve un agent du vote.', phase: 'day', camp: 'agent', image: '/cards/negociateur.png' },
  'Médecin': { color: 'text-emerald-400', icon: <Stethoscope size={16} />, description: 'Sauve la cible des espions.', phase: 'night', camp: 'agent', image: '/cards/medecin.png' },
  'Agent Gemini': { color: 'text-purple-400', icon: <Users size={16} />, description: 'Prend le rôle de son jumeau à sa mort.', phase: 'night', camp: 'neutral', image: '/cards/agent_gemini.png' },
  'Agent Fantôme': { color: 'text-slate-400', icon: <Ghost size={16} />, description: 'Doit éliminer sa cible en 3 tours.', phase: 'night', camp: 'neutral', image: '/cards/agent_fantome.png' },
  'Recrue': { color: 'text-slate-300', icon: <UserX size={16} />, description: 'Agent standard sans pouvoir.', phase: 'both', camp: 'agent', image: '/cards/recrue.png' },
};

const ROLE_ORDER: Record<RoleType, number> = {
  'Espion': 1,
  'Agent Secret': 2,
  'Agent Gemini': 3,
  'Enquêteur': 4,
  'Médecin': 5,
  'Ingénieur': 6,
  'Agent Double': 7,
  'Stratège': 8,
  'Polygraphiste': 9,
  'Supérieur Hiérarchique': 10,
  'Agent Russe': 11,
  'Hacker': 12,
  'Négociateur': 13,
  'Agent Fantôme': 14,
  'Recrue': 15
};

const RECOMMENDED_SETUPS: Record<number, { espions: number, agentsSecrets: number, special: RoleType[] }> = {
  8: { espions: 2, agentsSecrets: 3, special: ['Agent Gemini', 'Enquêteur', 'Médecin'] },
  9: { espions: 2, agentsSecrets: 3, special: ['Agent Gemini', 'Enquêteur', 'Médecin', 'Ingénieur'] },
  10: { espions: 2, agentsSecrets: 4, special: ['Agent Gemini', 'Enquêteur', 'Médecin', 'Ingénieur'] },
  11: { espions: 3, agentsSecrets: 4, special: ['Agent Gemini', 'Enquêteur', 'Médecin', 'Ingénieur'] },
  12: { espions: 3, agentsSecrets: 4, special: ['Agent Gemini', 'Enquêteur', 'Médecin', 'Ingénieur', 'Agent Double'] },
  13: { espions: 3, agentsSecrets: 5, special: ['Agent Gemini', 'Enquêteur', 'Médecin', 'Ingénieur', 'Agent Double'] },
  14: { espions: 3, agentsSecrets: 5, special: ['Agent Gemini', 'Enquêteur', 'Médecin', 'Ingénieur', 'Agent Double', 'Stratège'] },
  15: { espions: 4, agentsSecrets: 5, special: ['Agent Gemini', 'Enquêteur', 'Médecin', 'Ingénieur', 'Agent Double', 'Stratège'] },
  16: { espions: 4, agentsSecrets: 5, special: ['Agent Gemini', 'Enquêteur', 'Médecin', 'Ingénieur', 'Agent Double', 'Stratège', 'Polygraphiste'] },
  17: { espions: 4, agentsSecrets: 6, special: ['Agent Gemini', 'Enquêteur', 'Médecin', 'Ingénieur', 'Agent Double', 'Stratège', 'Polygraphiste'] },
  18: { espions: 4, agentsSecrets: 6, special: ['Agent Gemini', 'Enquêteur', 'Médecin', 'Ingénieur', 'Agent Double', 'Stratège', 'Polygraphiste', 'Supérieur Hiérarchique'] },
  19: { espions: 5, agentsSecrets: 6, special: ['Agent Gemini', 'Enquêteur', 'Médecin', 'Ingénieur', 'Agent Double', 'Stratège', 'Polygraphiste', 'Supérieur Hiérarchique'] },
  20: { espions: 5, agentsSecrets: 6, special: ['Agent Gemini', 'Enquêteur', 'Médecin', 'Ingénieur', 'Agent Double', 'Stratège', 'Polygraphiste', 'Supérieur Hiérarchique', 'Agent Russe'] },
  21: { espions: 5, agentsSecrets: 6, special: ['Agent Gemini', 'Enquêteur', 'Médecin', 'Ingénieur', 'Agent Double', 'Stratège', 'Polygraphiste', 'Supérieur Hiérarchique', 'Agent Russe', 'Hacker'] },
  22: { espions: 5, agentsSecrets: 6, special: ['Agent Gemini', 'Enquêteur', 'Médecin', 'Ingénieur', 'Agent Double', 'Stratège', 'Polygraphiste', 'Supérieur Hiérarchique', 'Agent Russe', 'Hacker', 'Négociateur'] },
  23: { espions: 6, agentsSecrets: 6, special: ['Agent Gemini', 'Enquêteur', 'Médecin', 'Ingénieur', 'Agent Double', 'Stratège', 'Polygraphiste', 'Supérieur Hiérarchique', 'Agent Russe', 'Hacker', 'Négociateur'] },
  24: { espions: 6, agentsSecrets: 6, special: ['Agent Gemini', 'Enquêteur', 'Médecin', 'Ingénieur', 'Agent Double', 'Stratège', 'Polygraphiste', 'Supérieur Hiérarchique', 'Agent Russe', 'Hacker', 'Négociateur', 'Agent Fantôme'] },
  25: { espions: 6, agentsSecrets: 7, special: ['Agent Gemini', 'Enquêteur', 'Médecin', 'Ingénieur', 'Agent Double', 'Stratège', 'Polygraphiste', 'Supérieur Hiérarchique', 'Agent Russe', 'Hacker', 'Négociateur', 'Agent Fantôme'] },
};

const generatePlayers = (count: number): Player[] => {
  const setup = RECOMMENDED_SETUPS[count] || RECOMMENDED_SETUPS[8];
  
  const roles: RoleType[] = [
    ...Array(setup.espions).fill('Espion'),
    ...Array(setup.agentsSecrets).fill('Agent Secret'),
    ...setup.special
  ] as RoleType[];

  // Fill remaining slots with Recrue if any (shouldn't happen with exact setups, but just in case)
  while (roles.length < count) {
    roles.push('Recrue');
  }

  return roles.slice(0, count).map((role, i) => ({
    id: i + 1,
    name: `Joueur ${i + 1}`,
    role,
    status: 'active',
    revealed: false,
  }));
};

const INITIAL_PLAYERS: Player[] = generatePlayers(8);

export const NIGHT_STEPS = [
  { role: 'Agent Gemini', action: 'Choisit son jumeau', condition: '1ère nuit uniquement' },
  { role: 'Agent Fantôme', action: 'Choisit sa cible à hanter', condition: '1ère nuit uniquement' },
  { role: 'Agent Double', action: 'Choix du camp (4 nuits max)', condition: 'Toujours' },
  { role: 'Polygraphiste', action: 'Teste un groupe de 3 agents', condition: 'Toujours' },
  { role: 'Ingénieur', action: 'Pose un dispositif de surveillance', condition: 'Toujours' },
  { role: 'Enquêteur', action: 'Interroge sur le pouvoir précédent', condition: 'Dès la 2e nuit' },
  { role: 'Espions', action: 'Désignent une cible à éliminer (Fantôme aussi)', condition: 'Toujours' },
  { role: 'Médecin', action: 'Décide de sauver la cible (1x)', condition: 'Toujours' },
  { role: 'Stratège', action: 'Place un mouchard (votes doubles)', condition: '1 nuit sur 2' },
];

// --- Components ---

export default function App() {
  const [players, setPlayers] = useState<Player[]>(INITIAL_PLAYERS);
  const [phase, setPhase] = useState<GamePhase>('Day');
  const [event, setEvent] = useState<GameEvent>('None');
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [codeDigits, setCodeDigits] = useState<(number | null)[]>([null, null, null, null, null, null]);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [missingImages, setMissingImages] = useState<Set<string>>(new Set());
  const [dismissedGameOver, setDismissedGameOver] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [newPlayerCount, setNewPlayerCount] = useState(10);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [currentNightStep, setCurrentNightStep] = useState(0);
  const [nightNumber, setNightNumber] = useState(0);
  const [isNightActionModalOpen, setIsNightActionModalOpen] = useState(false);
  const [geminiTwinId, setGeminiTwinId] = useState<number | null>(null);
  const [engineerTargetId, setEngineerTargetId] = useState<number | null>(null);
  const [spyTargetId, setSpyTargetId] = useState<number | null>(null);
  const [doctorSavedId, setDoctorSavedId] = useState<number | null>(null);
  
  // Night Revelation Logic
  const [nightEliminatedPlayerId, setNightEliminatedPlayerId] = useState<number | null>(null);
  const [ghostEliminatedPlayerId, setGhostEliminatedPlayerId] = useState<number | null>(null);
  const [isNightRevealPhase, setIsNightRevealPhase] = useState(false);
  const [nightRevealStep, setNightRevealStep] = useState(0); // 0: hidden, 1: name, 2: role

  // Ghost Logic
  const [ghostTargetId, setGhostTargetId] = useState<number | null>(null);
  const [ghostRoundsElapsed, setGhostRoundsElapsed] = useState(0);
  const [ghostSuccess, setGhostSuccess] = useState(false);
  const [showGhostSuccessModal, setShowGhostSuccessModal] = useState(false);

  // Stratège Logic
  const [mouchardTargetId, setMouchardTargetId] = useState<number | null>(null);

  // Enquêteur Logic
  const [investigatorTargetId, setInvestigatorTargetId] = useState<number | null>(null);
  const [showInvestigatorResult, setShowInvestigatorResult] = useState(false);

  // Vote Logic
  const [isVoteMode, setIsVoteMode] = useState(false);
  const [votes, setVotes] = useState<Record<number, number>>({});
  const [voteTieMessage, setVoteTieMessage] = useState<string | null>(null);
  const [eliminatedByVoteId, setEliminatedByVoteId] = useState<number | null>(null);
  const [isVoteRevealPhase, setIsVoteRevealPhase] = useState(false);
  const [isRoleRevealed, setIsRoleRevealed] = useState(false);
  const [isDecryptingEvent, setIsDecryptingEvent] = useState(false);

  // Hacker Logic
  const [isHackerPowerActive, setIsHackerPowerActive] = useState(false);

  // Agent Double Logic
  const [doubleAgentRoundsElapsed, setDoubleAgentRoundsElapsed] = useState(0);
  const [doubleAgentChoice, setDoubleAgentChoice] = useState<'agent' | 'espion' | null>(null);

  // Firebase & Dual Screen Logic
  const [user, setUser] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const isDirtyRef = useRef(false);
  const initialLoadDone = useRef(false);
  const [isAdminMode, setIsAdminMode] = useState(window.location.hash === '#admin');

  useEffect(() => {
    const handleHashChange = () => setIsAdminMode(window.location.hash === '#admin');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const docRef = doc(db, 'games', 'current_game');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (!isAdminMode || !initialLoadDone.current) {
          if (isAdminMode) initialLoadDone.current = true;
          isDirtyRef.current = false;
          setPlayers(data.players);
          setPhase(data.phase);
          setEvent(data.event);
          setTimer(data.timer);
          setIsTimerRunning(data.isTimerRunning);
          setCodeDigits(data.codeDigits);
          setCurrentNightStep(data.currentNightStep);
          setNightNumber(data.nightNumber || 1);
          setIsNightActionModalOpen(data.isNightActionModalOpen || false);
          setGeminiTwinId(data.geminiTwinId !== undefined ? data.geminiTwinId : null);
          setEngineerTargetId(data.engineerTargetId !== undefined ? data.engineerTargetId : null);
          setSpyTargetId(data.spyTargetId !== undefined ? data.spyTargetId : null);
          setDoctorSavedId(data.doctorSavedId !== undefined ? data.doctorSavedId : null);
          setNightEliminatedPlayerId(data.nightEliminatedPlayerId !== undefined ? data.nightEliminatedPlayerId : null);
          setGhostEliminatedPlayerId(data.ghostEliminatedPlayerId !== undefined ? data.ghostEliminatedPlayerId : null);
          setIsNightRevealPhase(data.isNightRevealPhase || false);
          setNightRevealStep(data.nightRevealStep !== undefined ? data.nightRevealStep : 0);
          setGhostTargetId(data.ghostTargetId !== undefined ? data.ghostTargetId : null);
          setGhostRoundsElapsed(data.ghostRoundsElapsed || 0);
          setGhostSuccess(data.ghostSuccess || false);
          setShowGhostSuccessModal(data.showGhostSuccessModal || false);
          setMouchardTargetId(data.mouchardTargetId !== undefined ? data.mouchardTargetId : null);
          setInvestigatorTargetId(data.investigatorTargetId !== undefined ? data.investigatorTargetId : null);
          setShowInvestigatorResult(data.showInvestigatorResult || false);
          setIsVoteMode(data.isVoteMode || false);
          setVotes(data.votes || {});
          setVoteTieMessage(data.voteTieMessage || null);
          setEliminatedByVoteId(data.eliminatedByVoteId || null);
          setIsVoteRevealPhase(data.isVoteRevealPhase || false);
          setIsRoleRevealed(data.isRoleRevealed || false);
          setIsHackerPowerActive(data.isHackerPowerActive || false);
          setDoubleAgentRoundsElapsed(data.doubleAgentRoundsElapsed || 0);
          setDoubleAgentChoice(data.doubleAgentChoice || null);
          setIsLoaded(true);
        }
      } else if (isAdminMode && !initialLoadDone.current) {
        initialLoadDone.current = true;
        setDoc(docRef, {
          players: INITIAL_PLAYERS,
          phase: 'Day',
          event: 'None',
          timer: 0,
          isTimerRunning: false,
          codeDigits: [null, null, null, null, null, null],
          currentNightStep: 0,
          nightNumber: 0,
          isNightActionModalOpen: false,
          geminiTwinId: null,
          engineerTargetId: null,
          spyTargetId: null,
          doctorSavedId: null,
          nightEliminatedPlayerId: null,
          ghostEliminatedPlayerId: null,
          isNightRevealPhase: false,
          nightRevealStep: 0,
          ghostTargetId: null,
          ghostRoundsElapsed: 0,
          ghostSuccess: false,
          showGhostSuccessModal: false,
          mouchardTargetId: null,
          investigatorTargetId: null,
          showInvestigatorResult: false,
          isVoteMode: false,
          votes: {},
          voteTieMessage: null,
          eliminatedByVoteId: null,
          isVoteRevealPhase: false,
          isRoleRevealed: false,
          isHackerPowerActive: false,
          doubleAgentRoundsElapsed: 0,
          doubleAgentChoice: null
        });
        setIsLoaded(true);
      }
    });
    return () => unsubscribe();
  }, [user, isAdminMode]);

  // Mark state as dirty when admin changes it
  useEffect(() => {
    if (isAdminMode && isLoaded) {
      isDirtyRef.current = true;
    }
  }, [
    players, phase, event, isTimerRunning, codeDigits, currentNightStep,
    nightNumber, isNightActionModalOpen, geminiTwinId, engineerTargetId, spyTargetId,
    doctorSavedId, ghostTargetId, ghostRoundsElapsed, ghostSuccess, showGhostSuccessModal,
    mouchardTargetId, isVoteMode, votes, voteTieMessage, eliminatedByVoteId,
    isVoteRevealPhase, isRoleRevealed, isHackerPowerActive, doubleAgentRoundsElapsed,
    doubleAgentChoice, nightEliminatedPlayerId, ghostEliminatedPlayerId, isNightRevealPhase, nightRevealStep,
    investigatorTargetId, showInvestigatorResult
  ]);

  // Sync to Firebase with debounce
  useEffect(() => {
    if (isAdminMode && user && isLoaded && isDirtyRef.current) {
      const timeoutId = setTimeout(() => {
        const docRef = doc(db, 'games', 'current_game');
        setDoc(docRef, {
          players,
          phase,
          event,
          timer,
          isTimerRunning,
          codeDigits,
          currentNightStep,
          nightNumber,
          isNightActionModalOpen,
          geminiTwinId,
          engineerTargetId,
          spyTargetId,
          doctorSavedId,
          nightEliminatedPlayerId,
          ghostEliminatedPlayerId,
          isNightRevealPhase,
          nightRevealStep,
          ghostTargetId,
          ghostRoundsElapsed,
          ghostSuccess,
          showGhostSuccessModal,
          mouchardTargetId,
          investigatorTargetId,
          showInvestigatorResult,
          isVoteMode,
          votes,
          voteTieMessage,
          eliminatedByVoteId,
          isVoteRevealPhase,
          isRoleRevealed,
          isHackerPowerActive,
          doubleAgentRoundsElapsed,
          doubleAgentChoice,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        isDirtyRef.current = false;
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [
    isAdminMode, user, isLoaded, players, phase, event, timer, isTimerRunning,
    codeDigits, currentNightStep, nightNumber, isNightActionModalOpen, geminiTwinId, 
    engineerTargetId, spyTargetId, doctorSavedId, ghostTargetId, ghostRoundsElapsed, 
    ghostSuccess, showGhostSuccessModal, mouchardTargetId, isVoteMode, votes, 
    voteTieMessage, eliminatedByVoteId, isVoteRevealPhase, isRoleRevealed, 
    isHackerPowerActive, doubleAgentRoundsElapsed, doubleAgentChoice,
    nightEliminatedPlayerId, ghostEliminatedPlayerId, isNightRevealPhase, nightRevealStep,
    investigatorTargetId, showInvestigatorResult
  ]);

  const confirmResetGame = (count?: number) => {
    const newPlayers = count ? generatePlayers(count) : generatePlayers(players.length);
    setPlayers(newPlayers);
    setPhase('Day');
    setNightNumber(0);
    setIsNightActionModalOpen(false);
    setCurrentNightStep(0);
    setGeminiTwinId(null);
    setEngineerTargetId(null);
    setSpyTargetId(null);
    setDoctorSavedId(null);
    setEvent('None');
    setTimer(0);
    setIsTimerRunning(false);
    setCodeDigits([null, null, null, null, null, null]);
    setIsAdminOpen(false);
    setSelectedPlayerId(null);
    setGhostTargetId(null);
    setGhostRoundsElapsed(0);
    setGhostSuccess(false);
    setShowGhostSuccessModal(false);
    setMouchardTargetId(null);
    setIsVoteMode(false);
    setVotes({});
    setVoteTieMessage(null);
    setEliminatedByVoteId(null);
    setIsVoteRevealPhase(false);
    setIsRoleRevealed(false);
    setIsHackerPowerActive(false);
    setDoubleAgentRoundsElapsed(0);
    setDoubleAgentChoice(null);
    setInvestigatorTargetId(null);
    setShowInvestigatorResult(false);
    setNightEliminatedPlayerId(null);
    setGhostEliminatedPlayerId(null);
    setIsNightRevealPhase(false);
    setNightRevealStep(0);
    setDismissedGameOver(false);
    setIsResetModalOpen(false);
  };

  const handleImageError = (imagePath: string) => {
    setMissingImages(prev => {
      const newSet = new Set(prev);
      newSet.add(imagePath);
      return newSet;
    });
  };

  // Timer logic (MJ)
  useEffect(() => {
    if (!isAdminMode) return;
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => Math.max(0, prev - 1));
      }, 1000);
    } else if (timer === 0) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isAdminMode, isTimerRunning, timer]);

  // Timer logic (Players - local sync)
  useEffect(() => {
    if (isAdminMode) return;
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isAdminMode, isTimerRunning]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePhaseChange = () => {
    if (!isAdminMode) return;
    const newPhase = phase === 'Day' ? 'Night' : 'Day';
    if (newPhase === 'Night') {
      setNightNumber(prev => prev + 1);
      setIsNightActionModalOpen(true);
      setCurrentNightStep(0);
      // Reset night-specific choices for the new night
      setSpyTargetId(null);
      setDoctorSavedId(null);
      // Engineer target might persist or change, usually changes each night
      setEngineerTargetId(null);
      setInvestigatorTargetId(null);
      setShowInvestigatorResult(false);
    }
    setPhase(newPhase);
  };

  const toggleStatus = (id: number, status: PlayerStatus) => {
    const targetPlayer = players.find(p => p.id === id);
    if (!targetPlayer) return;

    if (status === 'eliminated' && targetPlayer.status === 'active') {
      // Agent Fantôme Logic
      if (id === ghostTargetId && !ghostSuccess && ghostRoundsElapsed <= 3) {
        setGhostSuccess(true);
        setShowGhostSuccessModal(true);
      }

      // Agent Secret Logic
      const geminiTakesOver = id === geminiTwinId && players.some(g => g.role === 'Agent Gemini' && g.status === 'active');
      if (targetPlayer.role === 'Agent Secret' && !geminiTakesOver) {
        revealRandomDigit();
      }
    }

    setPlayers(prev => {
      let newPlayers = [...prev];
      const playerIndex = newPlayers.findIndex(p => p.id === id);
      if (playerIndex === -1) return prev;
      
      const p = newPlayers[playerIndex];

      // Agent Gemini Logic
      if (status === 'eliminated' && p.status === 'active' && id === geminiTwinId) {
        const geminiIndex = newPlayers.findIndex(g => g.role === 'Agent Gemini' && g.status === 'active');
        if (geminiIndex !== -1) {
          newPlayers[geminiIndex] = { ...newPlayers[geminiIndex], role: p.role };
        }
      }

      newPlayers[playerIndex] = { ...p, status };
      return newPlayers;
    });
  };

  const updateRole = (id: number, role: RoleType) => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, role } : p));
  };

  const toggleReveal = (id: number) => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, revealed: !p.revealed } : p));
  };

  const revealRandomDigit = () => {
    setCodeDigits(prev => {
      const emptyIndices = prev.map((d, i) => d === null ? i : null).filter(i => i !== null) as number[];
      if (emptyIndices.length > 0) {
        const randomIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        const newDigits = [...prev];
        newDigits[randomIndex] = Math.floor(Math.random() * 10);
        return newDigits;
      }
      return prev;
    });
  };

  const resetTimer = (duration: number = 240) => {
    setTimer(duration);
    setIsTimerRunning(false);
  };

  const handleAddVote = (id: number) => {
    if (!isAdminMode) return;
    setVotes(prev => ({
      ...prev,
      [id]: (prev[id] || 0) + 1
    }));
  };

  const handleRemoveVote = (id: number) => {
    if (!isAdminMode) return;
    setVotes(prev => {
      const current = prev[id] || 0;
      if (current <= 0) return prev;
      return {
        ...prev,
        [id]: current - 1
      };
    });
  };

  const handleEndVote = () => {
    if (!isAdminMode) return;
    
    let targetVotes = isHackerPowerActive ? Infinity : 0;
    let playersToEliminate: number[] = [];

    // Calculate effective votes
    const effectiveVotes = Object.entries(votes).reduce((acc, [idStr, countValue]) => {
      const id = Number(idStr);
      const count = countValue as number;
      acc[id] = id === mouchardTargetId ? count * 2 : count;
      return acc;
    }, {} as Record<number, number>);

    const activeVotes = Object.entries(effectiveVotes).filter(([_, countValue]) => (countValue as number) > 0);

    if (activeVotes.length === 0) {
      setIsVoteMode(false);
      setVotes({});
      setVoteTieMessage(null);
      return;
    }

    activeVotes.forEach(([idStr, countValue]) => {
      const count = countValue as number;
      if (isHackerPowerActive) {
        if (count < targetVotes) {
          targetVotes = count;
          playersToEliminate = [Number(idStr)];
        } else if (count === targetVotes) {
          playersToEliminate.push(Number(idStr));
        }
      } else {
        if (count > targetVotes) {
          targetVotes = count;
          playersToEliminate = [Number(idStr)];
        } else if (count === targetVotes) {
          playersToEliminate.push(Number(idStr));
        }
      }
    });

    if (playersToEliminate.length > 1) {
      const names = playersToEliminate.map(id => players.find(p => p.id === id)?.name).filter(Boolean).join(' et ');
      if (isHackerPowerActive) {
        setVoteTieMessage(`ÉGALITÉ (Piratage) : ${names} ont le moins de votes. Le Hacker doit choisir qui éliminer.`);
      } else {
        setVoteTieMessage(`ÉGALITÉ : ${names} sont à égalité. Veuillez revoter entre eux.`);
      }
      setVotes({});
      return;
    }

    if (playersToEliminate.length === 1) {
      setEliminatedByVoteId(playersToEliminate[0]);
      setIsVoteRevealPhase(true);
      setIsRoleRevealed(false);
    }
  };

  const handleRevealRole = () => {
    if (!isAdminMode) return;
    setIsRoleRevealed(true);
  };

  const handleCloseVoteReveal = () => {
    if (!isAdminMode) return;
    if (eliminatedByVoteId !== null) {
      toggleStatus(eliminatedByVoteId, 'eliminated');
    }
    setIsVoteMode(false);
    setIsVoteRevealPhase(false);
    setEliminatedByVoteId(null);
    setIsRoleRevealed(false);
    setVotes({});
    setVoteTieMessage(null);
  };

  const handleEventChange = (newEvent: GameEvent) => {
    setEvent(newEvent);
    if (newEvent === 'Silence') {
      resetTimer(60);
    } else {
      resetTimer(240);
    }
  };

  const handleRandomEvent = () => {
    if (isDecryptingEvent) return;
    setIsDecryptingEvent(true);
    
    const availableEvents: GameEvent[] = ['Silence', 'Mission Chaos', 'Veillée', 'Promotion', 'Protection Renforcée', 'Brouilleur d\'ondes'];
    
    let ticks = 0;
    const maxTicks = 20; // 2 seconds at 100ms
    
    const interval = setInterval(() => {
      const randomEvent = availableEvents[Math.floor(Math.random() * availableEvents.length)];
      setEvent(randomEvent);
      ticks++;
      
      if (ticks >= maxTicks) {
        clearInterval(interval);
        const finalEvent = availableEvents[Math.floor(Math.random() * availableEvents.length)];
        setEvent(finalEvent);
        setIsDecryptingEvent(false);
        resetTimer(finalEvent === 'Silence' ? 60 : 240);
      }
    }, 100);
  };

  const getPlayerCamp = useCallback((player: Player) => {
    if (player.role === 'Agent Double') {
      if (doubleAgentChoice === 'espion') return 'spy';
      if (doubleAgentChoice === 'agent') return 'agent';
      return 'neutral';
    }
    return ROLES_CONFIG[player.role]?.camp || 'agent';
  }, [doubleAgentChoice]);

  const stats = useMemo(() => {
    const active = players.filter(p => p.status === 'active');
    const activeAgents = active.filter(p => getPlayerCamp(p) === 'agent' || getPlayerCamp(p) === 'neutral').length;
    const eliminated = players.filter(p => p.status === 'eliminated').length;
    const spies = active.filter(p => getPlayerCamp(p) === 'spy').length;
    return { activeAgents, eliminated, spies };
  }, [players, doubleAgentChoice]);

  const tensionLevel = useMemo(() => {
    const totalPossibleAgents = players.filter(p => ROLES_CONFIG[p.role].camp !== 'spy').length;
    const deadAgents = players.filter(p => ROLES_CONFIG[p.role].camp !== 'spy' && p.status === 'eliminated').length;
    return totalPossibleAgents > 0 ? Math.round((deadAgents / totalPossibleAgents) * 100) : 0;
  }, [players]);

  const gameStatus = useMemo(() => {
    const active = players.filter(p => p.status === 'active');
    const activeSpies = active.filter(p => getPlayerCamp(p) === 'spy').length;
    const activeAgents = active.filter(p => getPlayerCamp(p) === 'agent' || getPlayerCamp(p) === 'neutral').length;
    const activeSecretAgents = active.filter(p => p.role === 'Agent Secret').length;

    if (activeSecretAgents === 0) {
      return { isOver: true, winner: 'spies', reason: 'Tous les Agents Secrets ont été éliminés.' };
    }
    if (activeSpies >= activeAgents && activeSpies > 0) {
      return { isOver: true, winner: 'spies', reason: 'Les Espions sont en majorité ou à égalité.' };
    }
    if (activeSpies === 0) {
      return { isOver: true, winner: 'agents', reason: 'Tous les Espions ont été éliminés.' };
    }
    return { isOver: false, winner: null, reason: null };
  }, [players, doubleAgentChoice]);

  useEffect(() => {
    if (!gameStatus.isOver) {
      setDismissedGameOver(false);
    }
  }, [gameStatus.isOver]);

  const sortedPlayers = [...players].sort((a, b) => {
    const orderDiff = (ROLE_ORDER[a.role] || 99) - (ROLE_ORDER[b.role] || 99);
    if (orderDiff !== 0) return orderDiff;
    return a.id - b.id;
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center max-w-md w-full shadow-2xl">
          <Shield size={64} className="text-indigo-500 mx-auto mb-6" />
          <h1 className="text-3xl font-display font-bold text-white uppercase italic tracking-tighter mb-4">
            O.S.I Connexion
          </h1>
          <p className="text-slate-400 mb-8">
            Veuillez vous connecter pour accéder au système de synchronisation.
          </p>
          <button
            onClick={signIn}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
          >
            <Lock size={20} />
            Connexion Sécurisée
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-[100dvh] bg-slate-950 text-slate-100 p-1 sm:p-2 lg:p-3 font-sans overflow-x-hidden overflow-y-auto lg:overflow-hidden flex flex-col ${tensionLevel > 70 ? 'tension-glow-high' : 'tension-glow-low'}`}>
      {tensionLevel > 70 && <div className="high-tension-overlay" />}
      {/* Night Guide Overlay */}
      <AnimatePresence>
        {phase === 'Night' && isAdminMode && (
          <motion.div 
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="fixed right-6 top-24 bottom-24 w-80 bg-slate-900/95 border border-indigo-500/30 rounded-3xl shadow-[0_0_30px_rgba(79,70,229,0.2)] z-40 flex flex-col overflow-hidden backdrop-blur-md"
          >
            <div className="p-5 border-b border-indigo-500/20 bg-indigo-500/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="text-indigo-400" size={18} />
                <h3 className="font-display font-bold uppercase tracking-wider text-sm">Guide du MJ</h3>
              </div>
              <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-full">
                {currentNightStep + 1} / {NIGHT_STEPS.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {NIGHT_STEPS.map((step, idx) => (
                <div 
                  key={idx}
                  className={`p-3 rounded-xl border transition-all duration-300 ${
                    currentNightStep === idx 
                      ? 'bg-indigo-500/20 border-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.1)]' 
                      : idx < currentNightStep 
                        ? 'bg-slate-950/50 border-slate-800 opacity-40' 
                        : 'bg-slate-900/50 border-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold uppercase tracking-tight ${currentNightStep === idx ? 'text-indigo-300' : 'text-slate-500'}`}>
                      {step.role}
                    </span>
                    <span className="text-[9px] font-mono text-slate-600 italic">{step.condition}</span>
                  </div>
                  <p className={`text-sm leading-tight ${currentNightStep === idx ? 'text-white' : 'text-slate-400'}`}>
                    {step.action}
                  </p>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-950/50 border-t border-indigo-500/20 flex gap-2">
              <button 
                onClick={() => setCurrentNightStep(Math.max(0, currentNightStep - 1))}
                disabled={currentNightStep === 0}
                className="flex-1 p-2 rounded-lg bg-slate-800 text-slate-400 disabled:opacity-30 hover:bg-slate-700 transition-colors"
              >
                Précédent
              </button>
              <button 
                onClick={() => {
                  if (currentNightStep < NIGHT_STEPS.length - 1) {
                    setCurrentNightStep(currentNightStep + 1);
                  } else {
                    setPhase('Day');
                    setCurrentNightStep(0);
                  }
                }}
                className="flex-[2] p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors flex items-center justify-center gap-2"
              >
                {currentNightStep === NIGHT_STEPS.length - 1 ? 'Fin de Nuit' : 'Suivant'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header Section */}
      <header className="flex flex-col xl:flex-row justify-between items-center mb-1 lg:mb-1.5 gap-2 lg:gap-3 shrink-0">
        <div className="flex flex-col sm:flex-row items-center sm:items-start xl:items-center gap-3 text-center sm:text-left">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden shrink-0 bg-slate-900 border-2 border-slate-700 shadow-[0_0_20px_rgba(0,0,0,0.3)]">
            <img 
              src="/logo_osi.png" 
              alt="logo_osi" 
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                e.currentTarget.parentElement?.classList.add('bg-red-600', 'border-red-400', 'shadow-[0_0_20px_rgba(220,38,38,0.5)]');
                e.currentTarget.parentElement?.classList.remove('bg-slate-900', 'border-slate-700', 'shadow-[0_0_20px_rgba(0,0,0,0.3)]');
              }}
            />
            <Eye className="text-white hidden" size={32} />
          </div>
          <div>
            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2 sm:gap-2">
              <h1 className={`text-xl sm:text-2xl lg:text-3xl font-display font-bold tracking-tighter uppercase italic transition-colors ${
                tensionLevel > 70 ? 'text-red-500 glitch-effect' : 'text-white'
              }`}>
                O.S.I <span className={tensionLevel > 70 ? 'text-white' : 'text-red-500'}>: Alerte Espions</span>
              </h1>
              {isAdminMode && (
                <div className="flex flex-wrap items-center justify-center gap-2 mt-2 sm:mt-0">
                  <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest">
                    Mode MJ
                  </span>
                  <button
                    onClick={() => setIsDashboardOpen(true)}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    <ClipboardList size={14} />
                    <span className="hidden sm:inline">Tableau de Bord</span>
                  </button>
                  <button
                    onClick={() => {
                      if (!isVoteMode) {
                        setVotes({});
                        setVoteTieMessage(null);
                      } else {
                        setIsVoteRevealPhase(false);
                        setEliminatedByVoteId(null);
                        setIsRoleRevealed(false);
                      }
                      setIsVoteMode(!isVoteMode);
                    }}
                    className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-colors border ${
                      isVoteMode 
                        ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30' 
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30'
                    }`}
                  >
                    {isVoteMode ? 'Fermer Vote' : 'Mode Vote'}
                  </button>
                </div>
              )}
            </div>
            <p className="text-slate-400 font-mono text-[10px] sm:text-xs tracking-widest uppercase mt-0.5">Organisation Secrète Internationale // Playtest Final</p>
          </div>
        </div>

        {/* Tension Meter */}
        <div className="hidden md:flex flex-col items-center gap-1 min-w-[120px]">
          <div className="flex justify-between w-full px-1">
            <span className={`text-[8px] font-mono uppercase tracking-widest ${tensionLevel > 70 ? 'text-red-500 glitch-effect' : 'text-slate-500'}`}>Tension Système</span>
            <span className={`text-[8px] font-mono font-bold ${tensionLevel > 70 ? 'text-red-500' : 'text-cyan-500'}`}>{tensionLevel}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-[1px]">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${tensionLevel}%` }}
              className={`h-full rounded-full ${
                tensionLevel > 70 ? 'bg-gradient-to-r from-red-600 to-red-400' : 
                tensionLevel > 40 ? 'bg-gradient-to-r from-amber-600 to-amber-400' : 
                'bg-gradient-to-r from-cyan-600 to-cyan-400'
              }`}
            />
          </div>
          <p className={`text-[7px] font-mono uppercase tracking-tighter ${tensionLevel > 70 ? 'text-red-400 animate-pulse' : 'text-slate-600'}`}>
            {tensionLevel > 70 ? '!!! ANOMALIE DÉTECTÉE !!!' : tensionLevel > 40 ? 'Instabilité croissante' : 'Système Stable'}
          </p>
        </div>

        {/* Code Display */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.3em]">Code de Sécurité</span>
          <div className="flex gap-1.5">
            {codeDigits.map((digit, i) => (
              <div 
                key={i} 
                className={`w-8 h-12 border-2 rounded flex items-center justify-center text-xl font-mono font-bold transition-all duration-500 ${
                  digit !== null 
                    ? 'border-cyan-500 text-cyan-400 bg-cyan-950/30 shadow-[0_0_10px_rgba(6,182,212,0.3)]' 
                    : 'border-slate-800 text-slate-800 bg-slate-900/50'
                }`}
              >
                {digit !== null ? digit : '?'}
              </div>
            ))}
          </div>
        </div>

        {/* Stats & Phase */}
        <div className="flex gap-3 items-center">
          <div className="flex flex-col items-end">
            <div className="flex gap-3 mb-0.5">
              <div className="text-right">
                <p className="text-[9px] text-slate-500 uppercase font-mono">Agents</p>
                <p className="text-lg font-display font-bold text-emerald-400">{stats.activeAgents}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-slate-500 uppercase font-mono">Espions</p>
                <p className="text-lg font-display font-bold text-red-500">{stats.spies}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-slate-500 uppercase font-mono">Pertes</p>
                <p className="text-lg font-display font-bold text-slate-400">{stats.eliminated}</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-1.5">
            <button 
              onClick={handlePhaseChange}
              className={`px-4 py-2 rounded-lg font-display font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 border-2 ${
                phase === 'Day' 
                  ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]' 
                  : 'bg-indigo-500/10 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
              } ${!isAdminMode ? 'cursor-default pointer-events-none' : ''}`}
            >
              {phase === 'Day' ? <Zap size={16} /> : <Eye size={16} />}
              {nightNumber === 0 ? 'Lancer' : (phase === 'Day' ? 'Jour' : 'Nuit')}
            </button>
            {isAdminMode && (
              <button
                onClick={() => setIsResetModalOpen(true)}
                className="px-4 py-2 rounded-xl font-display font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 border-2 bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 hover:bg-slate-700/50 text-xs"
              >
                <RotateCcw size={14} />
                Nouvelle Partie
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 flex flex-col lg:grid lg:grid-cols-4 gap-2 lg:gap-3 overflow-visible lg:overflow-hidden">
        
        {isVoteMode ? (
          <div className="lg:col-span-4 bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col overflow-hidden">
            {isVoteRevealPhase && eliminatedByVoteId !== null ? (
              <div className="flex-1 flex flex-col items-center justify-center py-6 sm:py-12">
                <h2 className="text-lg sm:text-2xl text-slate-400 font-mono uppercase tracking-widest mb-2 sm:mb-4">Joueur Éliminé</h2>
                <h1 className="text-4xl sm:text-7xl font-display font-black uppercase italic tracking-widest text-red-500 mb-6 sm:mb-12 text-center drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]">
                  {players.find(p => p.id === eliminatedByVoteId)?.name}
                </h1>
                
                <div className="h-[250px] sm:h-[400px] flex items-center justify-center w-full">
                  {isRoleRevealed ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.5, rotateY: 90 }}
                      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                      transition={{ type: "spring", duration: 0.8 }}
                      className="flex flex-col items-center"
                    >
                      <span className="text-lg sm:text-2xl text-slate-400 font-mono uppercase tracking-widest mb-3 sm:mb-6">Son rôle était</span>
                      <h3 className={`text-3xl sm:text-6xl font-display font-black uppercase italic tracking-tighter mb-4 sm:mb-8 ${ROLES_CONFIG[players.find(p => p.id === eliminatedByVoteId)?.role || 'Recrue'].color}`}>
                        {players.find(p => p.id === eliminatedByVoteId)?.role}
                      </h3>
                      {(() => {
                        const roleConfig = ROLES_CONFIG[players.find(p => p.id === eliminatedByVoteId)?.role || 'Recrue'];
                        const hasImage = !missingImages.has(roleConfig.image);
                        return hasImage ? (
                          <img 
                            src={roleConfig.image} 
                            alt="Role" 
                            className="w-40 sm:w-64 h-auto rounded-xl sm:rounded-2xl border-2 sm:border-4 border-slate-700 shadow-2xl"
                            onError={() => handleImageError(roleConfig.image)}
                          />
                        ) : (
                          <div className="w-40 sm:w-64 aspect-[4/5] bg-slate-800 rounded-xl sm:rounded-2xl flex items-center justify-center border-2 sm:border-4 border-slate-700">
                            {React.cloneElement(roleConfig.icon as React.ReactElement, { size: 80, className: "text-slate-600" })}
                          </div>
                        );
                      })()}
                    </motion.div>
                  ) : (
                    <motion.div 
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="flex flex-col items-center"
                    >
                      <HelpCircle size={100} className="text-slate-600 mb-6" />
                      <span className="text-2xl text-slate-500 font-mono uppercase tracking-widest">En attente de révélation...</span>
                    </motion.div>
                  )}
                </div>

                {isAdminMode && (
                  <div className="mt-12 flex gap-6">
                    {!isRoleRevealed ? (
                      <button 
                        onClick={handleRevealRole} 
                        className="px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xl uppercase tracking-wider transition-colors shadow-[0_0_30px_rgba(79,70,229,0.4)]"
                      >
                        Révéler le rôle
                      </button>
                    ) : (
                      <button 
                        onClick={handleCloseVoteReveal} 
                        className="px-10 py-5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xl uppercase tracking-wider transition-colors border border-slate-600"
                      >
                        Terminer et retourner
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-6 shrink-0">
                  <div className="flex items-center gap-4">
                    <h2 className="text-3xl font-display font-black uppercase italic tracking-widest text-white">Phase de Vote</h2>
                    {isHackerPowerActive && (
                      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-lg text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                        <Terminal size={16} /> Piratage Actif
                      </span>
                    )}
                  </div>
                  {isAdminMode && (
                    <button
                      onClick={handleEndVote}
                      className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold uppercase tracking-wider transition-colors shadow-[0_0_15px_rgba(220,38,38,0.3)]"
                    >
                      Fin de vote
                    </button>
                  )}
                </div>
                
                {voteTieMessage && (
                  <div className="mb-6 p-4 bg-amber-500/20 border-2 border-amber-500/50 rounded-xl text-amber-400 font-bold text-center text-lg animate-pulse">
                    {voteTieMessage}
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto custom-scrollbar pr-2 pb-4">
                  {players.filter(p => p.status === 'active').map(player => (
                    <div key={player.id} className={`bg-slate-800/50 border rounded-xl p-4 flex items-center justify-between ${
                      mouchardTargetId === player.id ? 'border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'border-slate-700'
                    }`}>
                      <div className="flex flex-col">
                        <span className="font-bold text-white text-lg">{player.name}</span>
                        {mouchardTargetId === player.id && (
                          <span className="text-[10px] font-bold uppercase text-purple-400 flex items-center gap-1 mt-1">
                            <Zap size={10} /> Mouchard (Votes x2)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                          <span className="text-3xl font-mono font-bold text-amber-400">{votes[player.id] || 0}</span>
                          {mouchardTargetId === player.id && (votes[player.id] || 0) > 0 && (
                            <span className="text-xs font-mono text-purple-400 font-bold">= {(votes[player.id] || 0) * 2}</span>
                          )}
                        </div>
                        {isAdminMode && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleRemoveVote(player.id)}
                              className="w-10 h-10 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors text-xl font-bold"
                            >
                              -
                            </button>
                            <button
                              onClick={() => handleAddVote(player.id)}
                              className="w-10 h-10 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors text-xl font-bold"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Left Sidebar: Events & Timer */}
            <div className="lg:col-span-1 flex flex-col gap-2 lg:gap-4">
          {/* Timer Card */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-slate-400 uppercase font-mono text-[10px] tracking-widest">
              <Timer size={12} /> Discussion
            </div>
            <div className={`text-5xl font-mono font-bold tracking-tighter ${timer < 30 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
              {formatTime(timer)}
            </div>
            <div className="flex gap-2 w-full">
              {isAdminMode && (
                <>
                  <button 
                    onClick={() => setIsTimerRunning(!isTimerRunning)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 p-3 rounded-lg flex items-center justify-center transition-colors"
                  >
                    {isTimerRunning ? <Pause size={20} /> : <Play size={20} />}
                  </button>
                  <button 
                    onClick={() => resetTimer(event === 'Silence' ? 60 : 240)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 p-3 rounded-lg flex items-center justify-center transition-colors"
                  >
                    <RotateCcw size={20} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Events Card */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex-1 overflow-y-auto">
            <h3 className="text-slate-500 uppercase font-mono text-[10px] tracking-widest mb-3 flex items-center gap-2">
              <AlertTriangle size={12} /> Événements Actifs
            </h3>
            
            {isAdminMode && (
              <button
                onClick={handleRandomEvent}
                disabled={isDecryptingEvent}
                className={`w-full mb-3 p-2 rounded-lg border flex items-center justify-center gap-2 font-bold uppercase tracking-wider transition-all text-xs ${
                  isDecryptingEvent 
                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400 animate-pulse' 
                    : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-white'
                }`}
              >
                <Cpu size={14} className={isDecryptingEvent ? 'animate-spin' : ''} />
                {isDecryptingEvent ? 'Décryptage...' : 'Tirer un sort'}
              </button>
            )}

            <div className="space-y-1.5">
              {(['None', 'Silence', 'Mission Chaos', 'Veillée', 'Promotion', 'Protection Renforcée', 'Brouilleur d\'ondes'] as GameEvent[]).map((e) => (
                <button
                  key={e}
                  onClick={() => isAdminMode && handleEventChange(e)}
                  className={`w-full text-left p-2 rounded-lg border transition-all duration-200 flex items-center justify-between group ${
                    event === e 
                      ? 'bg-red-500/10 border-red-500 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.1)]' 
                      : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-600'
                  } ${!isAdminMode ? 'cursor-default pointer-events-none' : ''}`}
                >
                  <span className="text-xs font-medium">{e === 'None' ? 'Aucun' : e}</span>
                  {e === 'Silence' && <VolumeX size={14} className={event === e ? 'text-red-400' : 'text-slate-600'} />}
                  {e === 'Veillée' && <Ghost size={14} className={event === e ? 'text-red-400' : 'text-slate-600'} />}
                  {e === 'Brouilleur d\'ondes' && <Radio size={14} className={event === e ? 'text-red-400' : 'text-slate-600'} />}
                </button>
              ))}
            </div>
            {event !== 'None' && (
              <div className="mt-4 p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                <p className="text-[10px] text-red-400 italic leading-tight">
                  {event === 'Silence' && "Le temps de discussion est réduit à 1 minute."}
                  {event === 'Mission Chaos' && "Les votes de cette journée seront tenus secrets."}
                  {event === 'Veillée' && "Les espions ne pourront pas tuer la prochaine nuit."}
                  {event === 'Promotion' && "2 agents reçoivent une promotion (vote double)."}
                  {event === 'Protection Renforcée' && "L'ingénieur peut surveiller deux joueurs."}
                  {event === 'Brouilleur d\'ondes' && "Seul les espions agissent la nuit."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Player Grid: Main View */}
        <div className={`lg:col-span-3 border rounded-2xl p-2 sm:p-2 overflow-y-visible lg:overflow-y-auto min-h-0 transition-colors duration-1000 ${
          tensionLevel > 70 
            ? 'bg-red-950/10 border-red-500/30' 
            : 'bg-slate-900/30 border-slate-800/50'
        }`}>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-9 gap-1.5 sm:gap-2">
            {(isAdminMode ? players : sortedPlayers).map((player) => (
              <motion.div
                key={player.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => {
                  if (isAdminMode) {
                    setSelectedPlayerId(player.id);
                    setIsAdminOpen(true);
                  }
                }}
                className={`relative aspect-[4/5] rounded-xl border-2 ${isAdminMode ? 'cursor-pointer' : ''} transition-all duration-300 flex flex-col overflow-hidden group ${
                  player.status === 'dead' ? 'bg-slate-950 border-slate-800 grayscale' :
                  player.status === 'eliminated' ? 'bg-slate-950 border-slate-900 opacity-50' :
                  (isAdminMode || player.revealed) ? (player.role === 'Espion' ? 'bg-red-950/20 border-red-500/50 spy-card-glow reveal-anim' : 'bg-emerald-950/20 border-emerald-500/50 agent-card-glow reveal-anim') :
                  'bg-slate-900/80 border-slate-800 hover:border-slate-600'
                }`}
              >
                {/* Card Content */}
                {(() => {
                  const roleConfig = ROLES_CONFIG[player.role];
                  const hasImage = !missingImages.has(roleConfig.image);
                  const isRoleVisible = true; // Always show roles on both screens

                  return (
                    <>
                      {/* Custom Image */}
                      {isRoleVisible && (
                        <img 
                          src={roleConfig.image} 
                          alt={player.role}
                          className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300 ${hasImage ? 'opacity-100' : 'opacity-0'}`}
                          onError={() => handleImageError(roleConfig.image)}
                        />
                      )}

                      {/* Player Number (Top Right) - ONLY SHOW FOR MJ */}
                      {isAdminMode && (
                        <div className="absolute top-1.5 right-1.5 z-20 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-white/10">
                          <span className="text-lg font-display font-black text-white">
                            {player.id.toString().padStart(2, '0')}
                          </span>
                        </div>
                      )}

                      {/* Fallback UI - Only show if not revealed or image is missing */}
                      {(!isRoleVisible || !hasImage) && (
                        <>
                          {/* Character Placeholder / Background */}
                          <div className="absolute inset-0 bg-gradient-to-b from-slate-800 to-slate-950 flex items-center justify-center z-0">
                            {!isRoleVisible ? (
                              <UserX size={40} className="text-slate-800" />
                            ) : (
                              <div className="opacity-20">
                                {React.cloneElement(roleConfig.icon as React.ReactElement, { size: 56 })}
                              </div>
                            )}
                          </div>

                          {/* Card Header (Icons like in PDF) */}
                          {isRoleVisible && (
                            <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 z-10">
                              <div className="bg-black/60 backdrop-blur-sm p-1 rounded-md flex flex-col items-center min-w-[30px]">
                                <span className="text-[7px] font-bold uppercase text-slate-300 leading-none mb-0.5">Rôle</span>
                                {roleConfig.phase === 'night' ? <Pause size={10} className="text-white rotate-90" /> : <Zap size={10} className="text-amber-400" />}
                              </div>
                              <div className="bg-black/60 backdrop-blur-sm p-1 rounded-full flex items-center justify-center w-6 h-6">
                                {roleConfig.camp === 'spy' || (player.role === 'Agent Double' && doubleAgentChoice === 'espion') ? (
                                  <span className="text-[10px]">👎</span>
                                ) : roleConfig.camp === 'agent' || (player.role === 'Agent Double' && doubleAgentChoice === 'agent') ? (
                                  <span className="text-[10px]">👍</span>
                                ) : (
                                  <div className="flex gap-0.5">
                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Bottom Info Box (Like PDF) */}
                          <div className="mt-auto relative z-10 bg-black/80 backdrop-blur-sm p-1.5 sm:p-2 border-t border-white/5">
                            <p className={`text-[7px] font-mono uppercase tracking-widest mb-0 ${player.status !== 'active' ? 'text-slate-600' : 'text-slate-500'}`}>
                              {player.status === 'active' ? 'Opérationnel' : 'Éliminé'}
                            </p>
                            <h4 className={`font-display font-bold leading-tight text-[10px] sm:text-[11px] uppercase italic tracking-tighter ${
                              !isRoleVisible ? 'text-white' : roleConfig.color
                            }`}>
                              {isRoleVisible ? (player.role === 'Agent Double' && doubleAgentChoice ? `Agent Double (${doubleAgentChoice === 'agent' ? 'Agent' : 'Espion'})` : player.role) : player.name}
                            </h4>
                          </div>
                        </>
                      )}

                      {/* Status Overlay for dead/eliminated */}
                      {player.status !== 'active' && (
                        <div className="absolute inset-0 bg-slate-950/40 rounded-2xl flex items-center justify-center pointer-events-none z-30">
                          <div className="rotate-[-15deg] border-4 border-red-600/50 px-2 py-1 rounded text-red-600/50 font-black uppercase text-xs backdrop-blur-sm bg-black/20">
                            Éliminé
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </motion.div>
            ))}
          </div>
        </div>
        </>
        )}
      </main>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {isResetModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
              onClick={() => setIsResetModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="relative w-full max-w-md bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl overflow-y-auto max-h-[90dvh] flex flex-col items-center text-center p-6 sm:p-8"
            >
              <AlertTriangle size={64} className="text-amber-500 mb-6" />
              <h2 className="text-3xl font-display font-black uppercase italic tracking-tighter mb-4 text-white">
                Nouvelle Partie
              </h2>
              <p className="text-slate-300 font-medium mb-6">
                Toute la progression actuelle sera perdue.
              </p>
              
              <div className="w-full mb-8 text-left">
                <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest mb-2">Nombre de joueurs</label>
                <select 
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-3 font-bold outline-none focus:border-indigo-500 transition-colors"
                  value={newPlayerCount}
                  onChange={(e) => setNewPlayerCount(parseInt(e.target.value, 10))}
                  id="player-count-select"
                >
                  {Object.keys(RECOMMENDED_SETUPS).map(count => (
                    <option key={count} value={count}>{count} Joueurs</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-2">Les rôles seront automatiquement adaptés selon les recommandations officielles.</p>
              </div>

              <div className="flex gap-4 w-full">
                <button 
                  onClick={() => setIsResetModalOpen(false)}
                  className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold uppercase tracking-wider transition-colors border border-slate-600"
                >
                  Annuler
                </button>
                <button 
                  onClick={() => {
                    confirmResetGame(newPlayerCount);
                    setIsResetModalOpen(false);
                  }}
                  className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold uppercase tracking-wider transition-colors"
                >
                  Confirmer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Game Over Modal */}
      <AnimatePresence>
        {gameStatus.isOver && !dismissedGameOver && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className={`relative w-full max-w-2xl border-2 rounded-3xl shadow-2xl overflow-hidden flex flex-col items-center text-center p-12 ${
                gameStatus.winner === 'spies' 
                  ? 'bg-red-950/80 border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.3)]' 
                  : 'bg-emerald-950/80 border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.3)]'
              }`}
            >
              {gameStatus.winner === 'spies' ? (
                <Skull size={80} className="text-red-500 mb-6" />
              ) : (
                <Shield size={80} className="text-emerald-500 mb-6" />
              )}
              <h2 className={`text-5xl font-display font-black uppercase italic tracking-tighter mb-4 ${
                gameStatus.winner === 'spies' ? 'text-red-500' : 'text-emerald-400'
              }`}>
                Victoire des {gameStatus.winner === 'spies' ? 'Espions' : 'Agents'}
              </h2>
              <p className="text-xl text-slate-300 font-medium mb-8">
                {gameStatus.reason}
              </p>
              {isAdminMode && (
                <button 
                  onClick={() => setDismissedGameOver(true)}
                  className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold uppercase tracking-wider transition-colors border border-slate-700"
                >
                  Fermer
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ghost Success Modal */}
      <AnimatePresence>
        {showGhostSuccessModal && (
          <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="relative w-full max-w-2xl bg-slate-900 border-2 border-slate-500 rounded-3xl shadow-[0_0_50px_rgba(148,163,184,0.3)] overflow-hidden flex flex-col items-center text-center p-12"
            >
              <Ghost size={80} className="text-slate-400 mb-6 animate-bounce" />
              <h2 className="text-5xl font-display font-black uppercase italic tracking-tighter mb-4 text-slate-300">
                Contrat Rempli
              </h2>
              <p className="text-xl text-slate-400 font-medium mb-8">
                L'Agent Fantôme a réussi à éliminer sa cible dans le temps imparti. Il survit à la partie !
              </p>
              {isAdminMode && (
                <button 
                  onClick={() => setShowGhostSuccessModal(false)}
                  className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold uppercase tracking-wider transition-colors border border-slate-600"
                >
                  Fermer
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Night Action Modal */}
      <AnimatePresence>
        {isNightActionModalOpen && (
          <NightActionModal
            isOpen={isNightActionModalOpen}
            isAdminMode={isAdminMode}
            nightNumber={nightNumber}
            currentNightStep={currentNightStep}
            setCurrentNightStep={setCurrentNightStep}
            players={players}
            geminiTwinId={geminiTwinId}
            setGeminiTwinId={setGeminiTwinId}
            doubleAgentChoice={doubleAgentChoice}
            setDoubleAgentChoice={setDoubleAgentChoice}
            engineerTargetId={engineerTargetId}
            setEngineerTargetId={setEngineerTargetId}
            spyTargetId={spyTargetId}
            setSpyTargetId={setSpyTargetId}
            doctorSavedId={doctorSavedId}
            setDoctorSavedId={setDoctorSavedId}
            mouchardTargetId={mouchardTargetId}
            setMouchardTargetId={setMouchardTargetId}
            ghostTargetId={ghostTargetId}
            setGhostTargetId={setGhostTargetId}
            ghostSuccess={ghostSuccess}
            toggleStatus={toggleStatus}
            setGhostRoundsElapsed={setGhostRoundsElapsed}
            setDoubleAgentRoundsElapsed={setDoubleAgentRoundsElapsed}
            setPhase={setPhase}
            setIsNightActionModalOpen={setIsNightActionModalOpen}
            setEvent={setEvent}
            setTimer={setTimer}
            setIsTimerRunning={setIsTimerRunning}
            setNightEliminatedPlayerId={setNightEliminatedPlayerId}
            setIsNightRevealPhase={setIsNightRevealPhase}
            setNightRevealStep={setNightRevealStep}
            ghostEliminatedPlayerId={ghostEliminatedPlayerId}
            setGhostEliminatedPlayerId={setGhostEliminatedPlayerId}
            investigatorTargetId={investigatorTargetId}
            setInvestigatorTargetId={setInvestigatorTargetId}
            showInvestigatorResult={showInvestigatorResult}
            setShowInvestigatorResult={setShowInvestigatorResult}
          />
        )}
      </AnimatePresence>

      {/* Investigator Public Result */}
      <AnimatePresence>
        {showInvestigatorResult && investigatorTargetId && (
          <motion.div
            key="investigator-result"
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[300] w-full max-w-md px-4 pointer-events-none"
          >
            <div className="bg-slate-900/95 backdrop-blur-xl border-2 border-cyan-500 rounded-3xl shadow-2xl shadow-cyan-500/20 overflow-hidden pointer-events-auto">
              <div className="bg-cyan-600/20 p-4 border-b border-cyan-500/30 flex items-center justify-center gap-3">
                <Search className="text-cyan-400" size={24} />
                <h3 className="text-xl font-display font-bold text-white uppercase tracking-tighter italic">
                  Enquête en cours
                </h3>
              </div>
              <div className="p-6 text-center space-y-4">
                <div className="space-y-1">
                  <p className="text-slate-400 text-[10px] uppercase font-mono tracking-widest">Sujet Interrogé</p>
                  <p className="text-3xl font-black text-white uppercase tracking-tight">
                    {players.find(p => p.id === investigatorTargetId)?.name || "Inconnu"}
                  </p>
                </div>
                
                <div className="py-4 border-y border-slate-800">
                  <p className="text-slate-500 text-[10px] uppercase font-mono mb-2">Statut d'activité nocturne</p>
                  {(() => {
                    const target = players.find(p => p.id === investigatorTargetId);
                    if (!target) return <div className="text-slate-500 italic">Analyse impossible</div>;
                    
                    const activeRoles = [
                      'Espion', 'Ingénieur', 'Enquêteur', 'Médecin', 
                      'Agent Gemini', 'Agent Double', 'Stratège', 
                      'Polygraphiste', 'Agent Fantôme'
                    ];
                    const isActive = activeRoles.includes(target.role);
                    
                    return (
                      <div className={`text-4xl font-display font-black uppercase tracking-tighter ${isActive ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {isActive ? 'ACTIF' : 'INACTIF'}
                      </div>
                    );
                  })()}
                </div>
                
                <p className="text-slate-500 text-[10px] italic">
                  Rapport généré par l'unité d'investigation
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Night Revelation Modal */}
      <AnimatePresence>
        {isNightRevealPhase && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              key="night-reveal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/98 backdrop-blur-2xl"
            />
            <motion.div 
              key="night-reveal-content"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-6 sm:p-8 text-center space-y-8 overflow-y-auto custom-scrollbar flex-1">
                <div className="space-y-2">
                  <h2 className="text-3xl font-display font-bold uppercase tracking-tighter text-white italic">
                    Rapport de Mission
                  </h2>
                  <p className="text-indigo-400 font-mono text-xs uppercase tracking-widest">
                    Analyse des activités nocturnes
                  </p>
                </div>

                <div className="py-12 flex flex-col items-center justify-center min-h-[300px] space-y-6">
                  {/* Phase 1: Spy Victim (Steps 0-2) */}
                  {nightRevealStep <= 2 && (
                    <>
                      {nightEliminatedPlayerId === null ? (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="space-y-4"
                        >
                          <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center border-2 border-emerald-500 mx-auto">
                            <Shield size={48} className="text-emerald-400" />
                          </div>
                          <p className="text-2xl font-bold text-emerald-400 uppercase tracking-tight">
                            Aucune victime à déplorer
                          </p>
                          <p className="text-slate-400 text-sm">
                            Le système de défense a tenu bon cette nuit.
                          </p>
                        </motion.div>
                      ) : (() => {
                        const eliminatedPlayer = players.find(p => p.id === nightEliminatedPlayerId);
                        if (!eliminatedPlayer) return null;

                        return (
                          <>
                            {nightRevealStep >= 1 ? (
                              <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-4"
                              >
                                <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center border-2 border-red-500 mx-auto">
                                  <Skull size={48} className="text-red-400" />
                                </div>
                                <h3 className="text-4xl font-display font-black text-white uppercase tracking-tighter">
                                  {eliminatedPlayer.name}
                                </h3>
                                <p className="text-red-500 font-bold uppercase tracking-widest text-sm">
                                  Éliminé(e) au cours de la nuit
                                </p>
                              </motion.div>
                            ) : (
                              <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center border-2 border-slate-700 animate-pulse">
                                <HelpCircle size={48} className="text-slate-600" />
                              </div>
                            )}

                            {(nightRevealStep >= 2 || isAdminMode) && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={`p-4 bg-slate-800/50 rounded-2xl border border-slate-700 w-full max-w-xs ${!isAdminMode && nightRevealStep < 2 ? 'hidden' : ''}`}
                              >
                                <p className="text-slate-500 text-[10px] uppercase font-mono mb-2">
                                  Identité Confirmée {isAdminMode && nightRevealStep < 2 && <span className="text-amber-500 ml-2">(Privé MJ)</span>}
                                </p>
                                <div className="flex items-center justify-center gap-3">
                                  <div className={ROLES_CONFIG[eliminatedPlayer.role as RoleType]?.color}>
                                    {ROLES_CONFIG[eliminatedPlayer.role as RoleType]?.icon}
                                  </div>
                                  <span className={`text-xl font-bold ${ROLES_CONFIG[eliminatedPlayer.role as RoleType]?.color}`}>
                                    {eliminatedPlayer.role}
                                  </span>
                                </div>
                              </motion.div>
                            )}
                          </>
                        );
                      })()}
                    </>
                  )}

                  {/* Phase 2: Ghost Death (Steps 3-4) */}
                  {nightRevealStep >= 3 && ghostEliminatedPlayerId !== null && (() => {
                    const ghostPlayer = players.find(p => p.id === ghostEliminatedPlayerId);
                    if (!ghostPlayer) return null;

                    return (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-6 w-full"
                      >
                        <div className="w-24 h-24 bg-slate-500/20 rounded-full flex items-center justify-center border-2 border-slate-400 mx-auto">
                          <Ghost size={48} className="text-slate-300" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-4xl font-display font-black text-white uppercase tracking-tighter">
                            {ghostPlayer.name}
                          </h3>
                          <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">
                            L'Agent Fantôme a échoué sa mission
                          </p>
                        </div>
                        
                        {(nightRevealStep >= 4 || isAdminMode) && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-4 bg-slate-800/50 rounded-2xl border border-slate-700 mx-auto w-full max-w-xs ${!isAdminMode && nightRevealStep < 4 ? 'hidden' : ''}`}
                          >
                            <p className="text-slate-500 text-[10px] uppercase font-mono mb-2">
                              Verdict Final {isAdminMode && nightRevealStep < 4 && <span className="text-amber-500 ml-2">(Privé MJ)</span>}
                            </p>
                            <div className="flex items-center justify-center gap-3">
                              <Ghost size={24} className="text-slate-400" />
                              <span className="text-xl font-bold text-slate-400 uppercase tracking-tight">Agent Fantôme</span>
                            </div>
                            <p className="mt-2 text-[10px] text-red-500 font-mono uppercase">Élimination par Malédiction</p>
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })()}
                </div>

                {isAdminMode && (
                  <div className="flex flex-col gap-3">
                    {/* Spy Victim Buttons */}
                    {nightEliminatedPlayerId !== null && nightRevealStep < 1 && (
                      <button
                        onClick={() => setNightRevealStep(1)}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/20"
                      >
                        Révéler la Victime
                      </button>
                    )}
                    {nightEliminatedPlayerId !== null && nightRevealStep === 1 && (
                      <button
                        onClick={() => setNightRevealStep(2)}
                        className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-bold uppercase tracking-wider transition-all shadow-lg shadow-red-500/20"
                      >
                        Révéler le Rôle
                      </button>
                    )}

                    {/* Transition to Ghost */}
                    {ghostEliminatedPlayerId !== null && (
                      (nightEliminatedPlayerId === null && nightRevealStep === 0) || 
                      (nightEliminatedPlayerId !== null && (nightRevealStep === 1 || nightRevealStep === 2))
                    ) && (
                      <button
                        onClick={() => setNightRevealStep(3)}
                        className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-2xl font-bold uppercase tracking-wider transition-all border border-slate-600"
                      >
                        {nightRevealStep === 1 ? "Passer le Rôle & Suite" : "Suite du Rapport"}
                      </button>
                    )}

                    {/* Ghost Buttons */}
                    {ghostEliminatedPlayerId !== null && nightRevealStep === 3 && (
                      <button
                        onClick={() => setNightRevealStep(4)}
                        className="w-full py-4 bg-slate-600 hover:bg-slate-500 text-white rounded-2xl font-bold uppercase tracking-wider transition-all shadow-lg shadow-slate-500/20"
                      >
                        Révéler le Rôle
                      </button>
                    )}

                    {/* End Reveal Button */}
                    {((ghostEliminatedPlayerId === null && (nightEliminatedPlayerId === null || nightRevealStep >= 1)) || 
                      (ghostEliminatedPlayerId !== null && (nightRevealStep === 3 || nightRevealStep >= 4))) && (
                      <button
                        onClick={() => {
                          if (nightEliminatedPlayerId !== null) {
                            toggleStatus(nightEliminatedPlayerId, 'eliminated');
                          }
                          if (ghostEliminatedPlayerId !== null) {
                            toggleStatus(ghostEliminatedPlayerId, 'eliminated');
                          }
                          setPhase('Day');
                          setIsNightRevealPhase(false);
                          setNightRevealStep(0);
                          setNightEliminatedPlayerId(null);
                          setGhostEliminatedPlayerId(null);
                          setInvestigatorTargetId(null);
                          setShowInvestigatorResult(false);
                          setEvent('None');
                          setTimer(240);
                          setIsTimerRunning(true);
                        }}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20"
                      >
                        {((ghostEliminatedPlayerId === null && nightRevealStep === 1) || (ghostEliminatedPlayerId !== null && nightRevealStep === 3)) 
                          ? "Passer le Rôle & Lancer le Jour" 
                          : "Lancer le Jour"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dashboard Modal */}
      <AnimatePresence>
        {isDashboardOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDashboardOpen(false)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-5xl max-h-[90dvh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 sm:p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h2 className="text-lg sm:text-xl font-display font-bold uppercase tracking-tight flex items-center gap-2 sm:gap-3 text-white">
                  <ClipboardList className="text-indigo-400" /> Tableau de Bord MJ
                </h2>
                <button onClick={() => setIsDashboardOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                  <UserX size={24} />
                </button>
              </div>

              {/* Role Summary */}
              <div className="p-3 sm:p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap gap-2">
                {Object.entries(
                  players.reduce((acc, p) => {
                    acc[p.role] = (acc[p.role] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([role, count]) => (
                  <div key={role} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs font-bold">
                    <span className={ROLES_CONFIG[role as RoleType]?.color || 'text-slate-400'}>
                      {ROLES_CONFIG[role as RoleType]?.icon && React.cloneElement(ROLES_CONFIG[role as RoleType].icon as React.ReactElement, { size: 12 })}
                    </span>
                    <span className="text-slate-300 uppercase">{role}:</span>
                    <span className="text-white">{count}</span>
                  </div>
                ))}
              </div>

              {/* Body: Player List */}
              <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-900">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {players.map(p => (
                    <div key={p.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-slate-500 uppercase font-bold">Joueur {p.id}</span>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${p.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                          {p.status === 'active' ? 'Actif' : 'Éliminé'}
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Identité</label>
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => setPlayers(prev => prev.map(player => player.id === p.id ? { ...player, name: e.target.value } : player))}
                          placeholder={`Nom du joueur ${p.id}`}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Rôle</label>
                        <select
                          value={p.role}
                          onChange={(e) => updateRole(p.id, e.target.value as RoleType)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                        >
                          {(Object.keys(ROLES_CONFIG) as RoleType[]).map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end">
                <button 
                  onClick={() => setIsDashboardOpen(false)} 
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase tracking-wider transition-colors"
                >
                  Terminer la configuration
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Modal */}
      <AnimatePresence>
        {isAdminOpen && selectedPlayerId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdminOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90dvh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-y-auto flex flex-col md:flex-row"
            >
              {/* Left Side: Physical Card Design */}
              <div className="w-full md:w-1/2 bg-slate-950 p-4 sm:p-6 flex items-center justify-center border-b md:border-b-0 md:border-r border-slate-800 shrink-0">
                {(() => {
                  const adminPlayer = players.find(p => p.id === selectedPlayerId);
                  const adminRoleConfig = ROLES_CONFIG[adminPlayer?.role || 'Recrue'];
                  const adminHasImage = !missingImages.has(adminRoleConfig.image);

                  return (
                    <div className="relative aspect-[2/3] w-full max-w-[300px] rounded-3xl border-8 border-slate-900 shadow-2xl overflow-hidden flex flex-col bg-gradient-to-b from-slate-800 to-slate-950">
                      {/* Custom Image */}
                      <img 
                        src={adminRoleConfig.image} 
                        alt={adminPlayer?.role}
                        className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300 ${adminHasImage ? 'opacity-100' : 'opacity-0'}`}
                        onError={() => handleImageError(adminRoleConfig.image)}
                      />

                      {/* Fallback UI */}
                      {!adminHasImage && (
                        <>
                          {/* Card Header Icons */}
                          <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                            <div className="bg-black/60 backdrop-blur-md p-2 rounded-xl flex flex-col items-center min-w-[50px]">
                              <span className="text-[10px] font-bold uppercase text-slate-300 mb-1">Rôle</span>
                              {adminRoleConfig.phase === 'night' ? <Pause size={20} className="text-white rotate-90" /> : <Zap size={20} className="text-amber-400" />}
                            </div>
                            <div className="bg-black/60 backdrop-blur-md p-2 rounded-full flex items-center justify-center w-12 h-12">
                              {adminRoleConfig.camp === 'spy' ? (
                                <span className="text-xl">👎</span>
                              ) : adminRoleConfig.camp === 'agent' ? (
                                <span className="text-xl">👍</span>
                              ) : (
                                <div className="flex gap-1">
                                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                                  <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Character Illustration Placeholder */}
                          <div className="flex-1 flex items-center justify-center opacity-10 z-0">
                            {React.cloneElement(adminRoleConfig.icon as React.ReactElement, { size: 120 })}
                          </div>

                          {/* Card Footer Info */}
                          <div className="bg-black/90 backdrop-blur-xl p-6 border-t border-white/10 z-10">
                            <h2 className={`text-4xl font-display font-black uppercase italic tracking-tighter mb-2 ${adminRoleConfig.color}`}>
                              {adminPlayer?.role}
                            </h2>
                            <p className="text-sm text-slate-300 leading-relaxed font-medium">
                              {adminRoleConfig.description}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Right Side: Admin Controls */}
              <div className="w-full md:w-1/2 flex flex-col">
                <div className="p-4 sm:p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                  <h2 className="text-lg sm:text-xl font-display font-bold uppercase tracking-tight">Configuration Agent {selectedPlayerId}</h2>
                  <button onClick={() => setIsAdminOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                    <UserX size={24} />
                  </button>
                </div>

                <div className="p-4 sm:p-6 flex-1 overflow-y-auto custom-scrollbar">
                  <div className="space-y-6">
                    {/* Name Section */}
                    <div>
                      <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Identité</h3>
                      <input 
                        type="text" 
                        value={players.find(p => p.id === selectedPlayerId)?.name || ''}
                        onChange={(e) => {
                          setPlayers(prev => prev.map(p => p.id === selectedPlayerId ? { ...p, name: e.target.value } : p));
                        }}
                        placeholder="Prénom du joueur..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                      />
                    </div>

                    {/* Status Section */}
                    <div>
                      <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">État de l'Agent</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {(['active', 'eliminated'] as PlayerStatus[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => toggleStatus(selectedPlayerId, s)}
                            className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                              players.find(p => p.id === selectedPlayerId)?.status === s
                                ? 'bg-slate-800 border-slate-400 text-white'
                                : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
                            }`}
                          >
                            {s === 'active' && <Shield size={16} className="text-emerald-500" />}
                            {s === 'eliminated' && <UserX size={16} className="text-slate-400" />}
                            <span className="text-[10px] font-bold uppercase">{s === 'active' ? 'Actif' : 'Éliminé'}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Gemini Twin Selection */}
                    {players.find(p => p.id === selectedPlayerId)?.role === 'Agent Gemini' && (
                      <div>
                        <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Jumeau (Cible)</h3>
                        <select
                          value={geminiTwinId || ''}
                          onChange={(e) => setGeminiTwinId(e.target.value ? Number(e.target.value) : null)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                        >
                          <option value="">Sélectionner un jumeau...</option>
                          {players.filter(p => p.id !== selectedPlayerId).map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Ghost Target Selection */}
                    {players.find(p => p.id === selectedPlayerId)?.role === 'Agent Fantôme' && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Cible à Hanter</h3>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            ghostSuccess ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {ghostSuccess ? 'Contrat Rempli' : `Tour ${ghostRoundsElapsed}/3`}
                          </span>
                        </div>
                        <select
                          value={ghostTargetId || ''}
                          onChange={(e) => setGhostTargetId(e.target.value ? Number(e.target.value) : null)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                        >
                          <option value="">Sélectionner une cible...</option>
                          {players.filter(p => p.id !== selectedPlayerId).map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                          ))}
                        </select>
                        
                        <div className="mt-4 flex items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                          <span className="text-xs font-medium text-slate-300">Compteur de tours</span>
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => setGhostRoundsElapsed(Math.max(0, ghostRoundsElapsed - 1))}
                              className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition-colors"
                            >-</button>
                            <span className="font-mono font-bold w-4 text-center">{ghostRoundsElapsed}</span>
                            <button 
                              onClick={() => {
                                const next = ghostRoundsElapsed + 1;
                                setGhostRoundsElapsed(next);
                                if (next >= 4 && !ghostSuccess && ghostTargetId !== null) {
                                  setPlayers(currentPlayers => {
                                    const ghostIndex = currentPlayers.findIndex(p => p.role === 'Agent Fantôme' && p.status === 'active');
                                    if (ghostIndex !== -1) {
                                      const newPlayers = [...currentPlayers];
                                      newPlayers[ghostIndex] = { ...newPlayers[ghostIndex], status: 'eliminated' };
                                      return newPlayers;
                                    }
                                    return currentPlayers;
                                  });
                                }
                              }}
                              className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition-colors"
                            >+</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Hacker Power Toggle */}
                    {players.find(p => p.id === selectedPlayerId)?.role === 'Hacker' && (
                      <div>
                        <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Pouvoir du Hacker</h3>
                        <button
                          onClick={() => setIsHackerPowerActive(!isHackerPowerActive)}
                          className={`w-full p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-3 font-bold uppercase tracking-wider ${
                            isHackerPowerActive
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                              : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
                          }`}
                        >
                          <Terminal size={20} />
                          {isHackerPowerActive ? 'Piratage Activé' : 'Activer Piratage'}
                        </button>
                      </div>
                    )}

                    {/* Agent Double Logic */}
                    {players.find(p => p.id === selectedPlayerId)?.role === 'Agent Double' && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Choix du Camp</h3>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            doubleAgentChoice ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {doubleAgentChoice ? 'Camp Choisi' : `Nuit ${doubleAgentRoundsElapsed}/4`}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          <button
                            onClick={() => setDoubleAgentChoice('agent')}
                            className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                              doubleAgentChoice === 'agent'
                                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
                            }`}
                          >
                            <Shield size={20} />
                            <span className="text-[10px] font-bold uppercase text-center">Devenir Agent</span>
                          </button>
                          <button
                            onClick={() => setDoubleAgentChoice('espion')}
                            className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                              doubleAgentChoice === 'espion'
                                ? 'bg-red-500/20 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                                : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
                            }`}
                          >
                            <Skull size={20} />
                            <span className="text-[10px] font-bold uppercase text-center">Devenir Espion</span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                          <span className="text-xs font-medium text-slate-300">Compteur de nuits</span>
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => setDoubleAgentRoundsElapsed(Math.max(0, doubleAgentRoundsElapsed - 1))}
                              className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition-colors"
                            >-</button>
                            <span className="font-mono font-bold w-4 text-center">{doubleAgentRoundsElapsed}</span>
                            <button 
                              onClick={() => setDoubleAgentRoundsElapsed(Math.min(4, doubleAgentRoundsElapsed + 1))}
                              className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition-colors"
                            >+</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Stratège Logic */}
                    {players.find(p => p.id === selectedPlayerId)?.role === 'Stratège' && (
                      <div className="mb-6">
                        <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <Zap size={12} className="text-purple-400" />
                          Cible du Mouchard (Votes x2)
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setMouchardTargetId(null)}
                            className={`p-2 rounded-lg border transition-all text-xs font-medium ${
                              mouchardTargetId === null
                                ? 'bg-slate-800 border-slate-500 text-white'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            Aucune cible
                          </button>
                          {players.filter(p => p.status === 'active').map(p => (
                            <button
                              key={p.id}
                              onClick={() => setMouchardTargetId(p.id)}
                              className={`p-2 rounded-lg border transition-all text-xs font-medium truncate ${
                                mouchardTargetId === p.id
                                  ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              {p.name} {p.id === selectedPlayerId ? '(Lui-même)' : ''}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Role Selection */}
                    <div>
                      <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Assigner un Rôle</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(ROLES_CONFIG) as RoleType[]).map((r) => (
                          <button
                            key={r}
                            onClick={() => updateRole(selectedPlayerId, r)}
                            className={`text-left p-2.5 rounded-lg border transition-all flex items-center gap-2 ${
                              players.find(p => p.id === selectedPlayerId)?.role === r
                                ? 'bg-slate-800 border-slate-500 text-white'
                                : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
                            }`}
                          >
                            <span className={ROLES_CONFIG[r].color}>
                              {React.cloneElement(ROLES_CONFIG[r].icon as React.ReactElement, { size: 14 })}
                            </span>
                            <span className="text-[11px] font-medium truncate">{r}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex gap-3">
                  <button
                    onClick={() => toggleReveal(selectedPlayerId)}
                    className={`flex-1 p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                      players.find(p => p.id === selectedPlayerId)?.revealed
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    {players.find(p => p.id === selectedPlayerId)?.revealed ? <Eye size={18} /> : <VolumeX size={18} />}
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {players.find(p => p.id === selectedPlayerId)?.revealed ? 'Révélé' : 'Caché'}
                    </span>
                  </button>
                  <button
                    onClick={() => setIsAdminOpen(false)}
                    className="flex-1 p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider transition-colors"
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer / Credits */}
      <footer className="mt-8 pt-4 border-t border-slate-900 flex justify-end items-center text-[10px] font-mono text-slate-600 uppercase tracking-widest">
        <p>Système de Surveillance O.S.I v4.0.2</p>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
      `}</style>
    </div>
  );
}
