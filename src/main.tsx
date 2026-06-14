import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { doc, getDocFromCache, getDocFromServer } from 'firebase/firestore';
import { db } from './lib/firebase';

// Simple connection test
async function testConnection() {
  try {
    // Attempting to fetch a non-existent doc just to verify config & reachability
    await getDocFromServer(doc(db, '_internal_', 'probe'));
    console.log('Firebase Cloud connection validated.');
  } catch (error: any) {
    if (error?.message?.includes('offline')) {
      console.warn('App is currently offline. Firestore will use local cache.');
    } else {
      console.error('Firebase Cloud initialization check:', error);
    }
  }
}

testConnection();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
