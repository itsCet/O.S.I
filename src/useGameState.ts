import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db, auth, signIn } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

export const GAME_DOC_ID = 'current_game';

export function useGameState(initialState: any) {
  const [gameState, setGameState] = useState(initialState);
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        signIn(); // Auto sign-in for simplicity in this local playtest
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const docRef = doc(db, 'games', GAME_DOC_ID);
    
    // Initialize doc if it doesn't exist
    getDoc(docRef).then((docSnap) => {
      if (!docSnap.exists()) {
        setDoc(docRef, initialState);
      }
    });

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setGameState(docSnap.data());
        setIsLoaded(true);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const updateGameState = useCallback((newStateOrUpdater: any) => {
    if (!user) return;
    
    setGameState((prevState: any) => {
      const newState = typeof newStateOrUpdater === 'function' ? newStateOrUpdater(prevState) : newStateOrUpdater;
      setDoc(doc(db, 'games', GAME_DOC_ID), newState);
      return newState;
    });
  }, [user]);

  return { gameState, updateGameState, isLoaded, user };
}
