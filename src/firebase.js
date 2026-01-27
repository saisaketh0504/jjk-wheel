import { initializeApp } from 'firebase/app'
import { getDatabase, ref, set, onValue, remove } from 'firebase/database'

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBlxbKdYDl47G1heeJ2jy9kZB-CLS2dQC0",
  authDomain: "realtime-database-2a3e8.firebaseapp.com",
  databaseURL: "https://realtime-database-2a3e8.firebaseio.com",
  projectId: "realtime-database-2a3e8",
  storageBucket: "realtime-database-2a3e8.firebasestorage.app",
  messagingSenderId: "199047295044",
  appId: "1:199047295044:web:dd7327cebd4f98ccee4c11",
  measurementId: "G-N6974ETZPX"
}

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)

// Firebase operations
export function updateSessionState(sessionId, state) {
  const sessionRef = ref(db, `sessions/${sessionId}`)
  set(sessionRef, state).catch((e) => console.error('Firebase write error:', e))
}

export function listenToSessionState(sessionId, onStateChange) {
  const sessionRef = ref(db, `sessions/${sessionId}`)
  
  const unsubscribe = onValue(sessionRef, (snapshot) => {
    const data = snapshot.val()
    if (data) {
      console.log('Firebase listener received:', data)
      onStateChange(data)
    }
  }, (error) => {
    console.error('Firebase listener error:', error)
  })
  
  return unsubscribe
}
