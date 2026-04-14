import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Moon, 
  Shield, 
  Eye, 
  Search, 
  AlertTriangle, 
  Skull, 
  TrendingUp 
} from 'lucide-react';
import { 
  Player, 
  RoleType, 
  ROLES_CONFIG, 
  NIGHT_STEPS,
  GameEvent
} from '../App';

interface NightActionModalProps {
  isOpen: boolean;
  isAdminMode: boolean;
  nightNumber: number;
  currentNightStep: number;
  setCurrentNightStep: React.Dispatch<React.SetStateAction<number>>;
  players: Player[];
  geminiTwinId: number | null;
  setGeminiTwinId: (id: number | null) => void;
  doubleAgentChoice: 'agent' | 'espion' | null;
  setDoubleAgentChoice: (choice: 'agent' | 'espion' | null) => void;
  engineerTargetId: number | null;
  setEngineerTargetId: (id: number | null) => void;
  spyTargetId: number | null;
  setSpyTargetId: (id: number | null) => void;
  doctorSavedId: number | null;
  setDoctorSavedId: (id: number | null) => void;
  mouchardTargetId: number | null;
  setMouchardTargetId: (id: number | null) => void;
  ghostTargetId: number | null;
  ghostSuccess: boolean;
  toggleStatus: (id: number, status: 'active' | 'eliminated') => void;
  setGhostRoundsElapsed: React.Dispatch<React.SetStateAction<number>>;
  setDoubleAgentRoundsElapsed: React.Dispatch<React.SetStateAction<number>>;
  setPhase: (phase: 'Day' | 'Night') => void;
  setIsNightActionModalOpen: (open: boolean) => void;
  setEvent: (event: GameEvent) => void;
  setTimer: (timer: number) => void;
  setIsTimerRunning: (running: boolean) => void;
  setNightEliminatedPlayerId: (id: number | null) => void;
  setIsNightRevealPhase: (open: boolean) => void;
  setNightRevealStep: (step: number) => void;
}

export const NightActionModal: React.FC<NightActionModalProps> = ({
  isOpen,
  isAdminMode,
  nightNumber,
  currentNightStep,
  setCurrentNightStep,
  players,
  geminiTwinId,
  setGeminiTwinId,
  doubleAgentChoice,
  setDoubleAgentChoice,
  engineerTargetId,
  setEngineerTargetId,
  spyTargetId,
  setSpyTargetId,
  doctorSavedId,
  setDoctorSavedId,
  mouchardTargetId,
  setMouchardTargetId,
  ghostTargetId,
  ghostSuccess,
  toggleStatus,
  setGhostRoundsElapsed,
  setDoubleAgentRoundsElapsed,
  setPhase,
  setIsNightActionModalOpen,
  setEvent,
  setTimer,
  setIsTimerRunning,
  setNightEliminatedPlayerId,
  setIsNightRevealPhase,
  setNightRevealStep,
}) => {
  if (!isOpen || !isAdminMode) return null;

  const filteredSteps = NIGHT_STEPS.filter(s => {
    const roleAlive = players.some(p => p.role === (s.role === 'Espions' ? 'Espion' : s.role) && p.status === 'active');
    if (!roleAlive) return false;
    if (s.role === 'Agent Gemini') return nightNumber === 1;
    if (s.role === 'Agent Double') return nightNumber <= 4;
    if (s.role === 'Enquêteur') return nightNumber >= 2;
    if (s.role === 'Stratège') return nightNumber % 2 === 1;
    return true;
  });

  const step = filteredSteps[currentNightStep];

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-indigo-600/10">
          <div>
            <h2 className="text-2xl font-display font-bold uppercase tracking-tight flex items-center gap-3 text-white">
              <Moon className="text-indigo-400" /> Guide de Nuit - Nuit {nightNumber}
            </h2>
            <p className="text-slate-400 text-xs font-mono uppercase tracking-widest mt-1">
              Étape {currentNightStep + 1} sur {filteredSteps.length}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 bg-slate-800 rounded-full border border-slate-700">
              <span className="text-xs font-bold text-indigo-400 font-mono italic">MJ MODE</span>
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
          {!step ? (
            <div className="text-center text-slate-400">Fin des étapes.</div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                <div className={`p-3 rounded-xl bg-slate-900 border border-slate-700 ${ROLES_CONFIG[step.role === 'Espions' ? 'Espion' : step.role as RoleType]?.color}`}>
                  {ROLES_CONFIG[step.role === 'Espions' ? 'Espion' : step.role as RoleType]?.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{step.role}</h3>
                  <p className="text-indigo-400 font-medium">{step.action}</p>
                </div>
              </div>

              <div className="space-y-4">
                {step.role === 'Agent Gemini' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {players.filter(p => p.status === 'active' && p.role !== 'Agent Gemini').map(p => (
                      <button
                        key={p.id}
                        onClick={() => setGeminiTwinId(p.id)}
                        className={`p-3 rounded-xl border text-sm font-bold transition-all ${geminiTwinId === p.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}

                {step.role === 'Agent Double' && (
                  <div className="flex gap-4">
                    <button
                      onClick={() => setDoubleAgentChoice('agent')}
                      className={`flex-1 p-4 rounded-2xl border-2 font-bold transition-all flex flex-col items-center gap-2 ${doubleAgentChoice === 'agent' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                    >
                      <Shield size={32} />
                      AGENTS
                    </button>
                    <button
                      onClick={() => setDoubleAgentChoice('espion')}
                      className={`flex-1 p-4 rounded-2xl border-2 font-bold transition-all flex flex-col items-center gap-2 ${doubleAgentChoice === 'espion' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                    >
                      <Eye size={32} />
                      ESPIONS
                    </button>
                  </div>
                )}

                {step.role === 'Ingénieur' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {players.filter(p => p.status === 'active').map(p => (
                      <button
                        key={p.id}
                        onClick={() => setEngineerTargetId(p.id)}
                        className={`p-3 rounded-xl border text-sm font-bold transition-all ${engineerTargetId === p.id ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}

                {step.role === 'Espions' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {players.filter(p => p.status === 'active' && p.role !== 'Espion').map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSpyTargetId(p.id)}
                          className={`p-3 rounded-xl border text-sm font-bold transition-all ${spyTargetId === p.id ? 'bg-red-600 border-red-400 text-white shadow-lg shadow-red-500/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                    {spyTargetId && engineerTargetId === spyTargetId && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-red-500/20 border border-red-500 rounded-xl flex items-center gap-3 text-red-400 font-bold"
                      >
                        <AlertTriangle size={24} />
                        ATTENTION : Cible sous surveillance de l'Ingénieur !
                      </motion.div>
                    )}
                  </div>
                )}

                {step.role === 'Médecin' && (
                  <div className="space-y-4">
                    <p className="text-slate-400 text-sm italic">La cible des espions est : <span className="text-white font-bold">{players.find(p => p.id === spyTargetId)?.name || 'Non définie'}</span></p>
                    <div className="flex gap-4">
                      <button
                        onClick={() => setDoctorSavedId(spyTargetId)}
                        className={`flex-1 p-4 rounded-2xl border-2 font-bold transition-all flex flex-col items-center gap-2 ${doctorSavedId === spyTargetId ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                      >
                        <Shield size={32} />
                        SAUVER
                      </button>
                      <button
                        onClick={() => setDoctorSavedId(null)}
                        className={`flex-1 p-4 rounded-2xl border-2 font-bold transition-all flex flex-col items-center gap-2 ${doctorSavedId === null ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                      >
                        <Skull size={32} />
                        LAISSER MOURIR
                      </button>
                    </div>
                  </div>
                )}

                {step.role === 'Stratège' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {players.filter(p => p.status === 'active').map(p => (
                      <button
                        key={p.id}
                        onClick={() => setMouchardTargetId(p.id)}
                        className={`p-3 rounded-xl border text-sm font-bold transition-all ${mouchardTargetId === p.id ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-500/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}

                {step.role === 'Enquêteur' && (
                  <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 text-center">
                    <Search size={48} className="text-cyan-400 mx-auto mb-4" />
                    <p className="text-slate-300 font-medium">Demandez à l'Enquêteur s'il souhaite interroger un joueur sur l'utilisation de son pouvoir la nuit précédente.</p>
                  </div>
                )}

                {step.role === 'Polygraphiste' && (
                  <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 text-center">
                    <TrendingUp size={48} className="text-yellow-400 mx-auto mb-4" />
                    <p className="text-slate-300 font-medium">Le Polygraphiste teste un groupe de 3 agents pour découvrir s'il y a au moins un espion parmi eux.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-950 flex gap-4">
          <button 
            onClick={() => {
              if (currentNightStep > 0) setCurrentNightStep(prev => prev - 1);
            }}
            disabled={currentNightStep === 0}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl font-bold uppercase tracking-wider transition-colors border border-slate-700"
          >
            Précédent
          </button>
          
          {currentNightStep < filteredSteps.length - 1 ? (
            <button 
              onClick={() => setCurrentNightStep(prev => prev + 1)}
              className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase tracking-wider transition-colors shadow-lg shadow-indigo-500/20"
            >
              Étape Suivante
            </button>
          ) : (
            <button 
              onClick={() => {
                // Calculate Night Results
                if (spyTargetId && doctorSavedId !== spyTargetId) {
                  setNightEliminatedPlayerId(spyTargetId);
                } else {
                  setNightEliminatedPlayerId(null);
                }
                
                // Ghost Logic increment
                setGhostRoundsElapsed(prev => prev + 1);

                // Double Agent Logic increment
                if (doubleAgentChoice) {
                  setDoubleAgentRoundsElapsed(prev => prev + 1);
                }

                setIsNightRevealPhase(true);
                setNightRevealStep(0);
                setIsNightActionModalOpen(false);
              }}
              className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold uppercase tracking-wider transition-colors shadow-lg shadow-emerald-500/20"
            >
              Terminer la Nuit & Révélation
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
